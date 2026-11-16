import type { Settlement, World } from '../types/world.ts';
import { Biome } from '../types/world.ts';
import { MinHeap } from '../utils/heap.ts';
import { clamp } from '../utils/math.ts';
import { DX, DY, DIST } from '../utils/math.ts';
import { hash2 } from '../utils/random.ts';
import { CITY_POP, MAX_SETTLEMENTS, TOWN_POP } from './constants.ts';
import { carryingCapacity, computeEconomy, updateFarmland } from './economy.ts';
import { pushEvent } from './events.ts';
import { localFlatness } from './metrics.ts';
import { riverThreshold } from './water.ts';

/** 洪水リスク。大きな川沿いの低平地が、雨の多いときに危ない。 */
export function computeFloodRisk(world: World): void {
  const { size, water, risk, height } = world;
  const ocean = world.hydro.ocean;
  const intensity = clamp((world.rainfall - 0.6) / 1.4, 0, 1);
  const base = 0.35 + 0.65 * intensity;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (ocean[i] || world.rainfall <= 0) {
        risk[i] = 0;
        continue;
      }
      let q = water[i];
      for (let d = 0; d < 8; d++) {
        const nx = x + DX[d];
        const ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const w = water[ny * size + nx];
        if (w > q) q = w;
      }
      const f = Math.log10(1 + q) / Math.log10(1 + 3000);
      const flat = localFlatness(height, x, y, size);
      risk[i] = clamp(f * (0.4 + 0.6 * flat) * base, 0, 1);
    }
  }
}

/**
 * 居住適性 = 水への近さ × 0.4 + 平地度 × 0.3 + 植生 × 0.2 + 交通の便 × 0.1
 */
export function computeSettlementSuitability(world: World, x: number, y: number): number {
  const { size, vegetation, waterDist, height } = world;
  const i = y * size + x;
  const waterAccess = Math.exp(-waterDist[i] / 6);
  const flatness = localFlatness(height, x, y, size);
  const transport = transportAccess(world, x, y);
  return waterAccess * 0.4 + flatness * 0.3 + Math.min(1, vegetation[i] * 1.4) * 0.2 + transport * 0.1;
}

export function transportAccess(world: World, x: number, y: number): number {
  if (world.settlements.length === 0) return 0.3;
  let best = Infinity;
  for (const s of world.settlements) {
    const d = Math.hypot(s.x - x, s.y - y);
    if (d < best) best = d;
  }
  return Math.exp(-best / 14);
}

function levelOf(pop: number): 1 | 2 | 3 {
  return pop >= CITY_POP ? 3 : pop >= TOWN_POP ? 2 : 1;
}

function foundingText(world: World, x: number, y: number): string {
  const { size, hydro } = world;
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      if (hydro.ocean[ny * size + nx]) return '海岸に港の集落が発生した';
    }
  }
  const i = y * size + x;
  if (world.waterDist[i] <= 3) return '川沿いに集落が発生した';
  return '平野に集落が発生した';
}

export function updateSettlements(world: World): void {
  const { size } = world;
  const ocean = world.hydro.ocean;

  // 食料の収容力。人口が収容力に近づくと「人口圧」が高まり、移住と新しい集落の元になる。
  const caps = new Map<Settlement, number>();
  for (const s of world.settlements) caps.set(s, carryingCapacity(world, s));

  // 発生: 最初は開拓者、その後は人口圧のかかった集落からの分村（出芽）
  if (world.tick % 3 === 0 && world.settlements.length < MAX_SETTLEMENTS && world.rainfall > 0) {
    let source: Settlement | null = null;
    let pressure = 0;
    for (const s of world.settlements) {
      const p = s.pop / caps.get(s)!;
      if (s.pop >= 120 && p >= 0.5 && p > pressure) {
        pressure = p;
        source = s;
      }
    }
    if (world.settlements.length === 0 || source) {
      let best = -1;
      let bestScore = 0.55;
      const thr = riverThreshold(world);
      for (let y = 2; y < size - 2; y += 2) {
        for (let x = 2; x < size - 2; x += 2) {
          const i = y * size + x;
          if (ocean[i] || world.lake[i] > 0 || world.water[i] > thr) continue;
          if (world.height[i] < world.seaLevel + 0.015) continue;
          if (world.temperature[i] < 2 || world.vegetation[i] < 0.1) continue;
          if (world.risk[i] > 0.5) continue;
          // 移民は徒歩で行ける範囲（約 50 km）に限られる
          if (source && Math.hypot(source.x - x, source.y - y) > 42) continue;
          let tooClose = false;
          for (const s of world.settlements) {
            if (Math.hypot(s.x - x, s.y - y) < 8) {
              tooClose = true;
              break;
            }
          }
          if (tooClose) continue;
          const score =
            computeSettlementSuitability(world, x, y) + hash2(world.seed, i, world.tick) * 0.04;
          if (score > bestScore) {
            bestScore = score;
            best = i;
          }
        }
      }
      if (best >= 0) {
        const x = best % size;
        const y = (best - x) / size;
        let pop = 24;
        if (source) {
          pop = Math.max(24, source.pop * 0.15);
          source.pop -= pop;
        }
        const s: Settlement = { x, y, pop, founded: world.time, level: 1, gdp: 0, port: false, market: 0 };
        world.settlements.push(s);
        caps.set(s, carryingCapacity(world, s));
        pushEvent(world, 'settlement', foundingText(world, x, y));
        connectRoad(world, s);
      }
    }
  }

  // 人口移動: 収容力を超えた集落から、余裕のある集落へ（重力モデル: 余裕 / 距離²）
  for (const a of world.settlements) {
    const over = a.pop - caps.get(a)!;
    if (over <= 0) continue;
    let wSum = 0;
    const ws: Array<[Settlement, number]> = [];
    for (const b of world.settlements) {
      if (b === a) continue;
      const room = caps.get(b)! - b.pop;
      if (room <= 0) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > 60) continue;
      const w = room / (1 + (d * d) / 50);
      ws.push([b, w]);
      wSum += w;
    }
    if (wSum <= 0) continue;
    const out = Math.min(over * 0.25, a.pop * 0.05);
    a.pop -= out;
    for (const [b, w] of ws) b.pop += (out * w) / wSum;
  }

  // 成長・衰退（ロジスティック成長）
  const survivors: Settlement[] = [];
  for (const s of world.settlements) {
    const i = s.y * size + s.x;
    const cap = caps.get(s)!;
    if (s.pop < cap) {
      s.pop += s.pop * 0.05 * world.settlementGrowthRate * (1 - s.pop / cap);
    } else {
      s.pop -= (s.pop - cap) * 0.04;
    }

    // 洪水
    if (world.rainfall > 1.5 && world.risk[i] > 0.5) {
      s.pop *= 0.9;
      if ((world.memo.floodAt ?? -99) <= world.tick - 8) {
        world.memo.floodAt = world.tick;
        pushEvent(world, 'flood', '豪雨で川が氾濫し、川沿いの集落が被害を受けた');
      }
    }

    // 湖・海面の上昇による水没
    if (ocean[i] || world.lake[i] > 0.004) {
      pushEvent(world, 'abandon', '集落が水没し、人々は移り住んだ');
      continue;
    }
    if (s.pop < 4) {
      pushEvent(world, 'abandon', '環境が悪化し、集落が放棄された');
      continue;
    }
    const level = levelOf(s.pop);
    if (level > s.level) {
      if (level === 3) pushEvent(world, 'city', '集落が都市へ発展した');
      if (level >= 2) connectRoad(world, s);
    }
    s.level = level;
    survivors.push(s);
  }
  world.settlements = survivors;

  updateFarmland(world);
  if (world.tick % 2 === 0) computeEconomy(world);

  world.settlement.fill(0);
  world.population.fill(0);
  for (const s of world.settlements) {
    const i = s.y * size + s.x;
    world.settlement[i] = s.level;
    world.population[i] = s.pop;
    world.biome[i] = Biome.Grassland;
  }
}

/** 道路 = 低コスト経路。傾斜・水域・森林を避け、既存の道路は使い回す。 */
export function connectRoad(world: World, from: Settlement): void {
  let target: Settlement | null = null;
  let best = Infinity;
  for (const s of world.settlements) {
    if (s === from) continue;
    const d = Math.hypot(s.x - from.x, s.y - from.y);
    if (d < best) {
      best = d;
      target = s;
    }
  }
  if (!target) return;

  const { size, height, vegetation, lake, road, water } = world;
  const ocean = world.hydro.ocean;
  const thr = riverThreshold(world);
  const n = size * size;
  const dist = new Float32Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const heap = new MinHeap(n);
  const start = from.y * size + from.x;
  const goal = target.y * size + target.x;
  dist[start] = 0;
  heap.push(0, start);

  while (heap.size > 0) {
    const i = heap.pop();
    const d = heap.popKey;
    if (d > dist[i]) continue;
    if (i === goal) break;
    const ix = i % size;
    const iy = (i - ix) / size;
    for (let k = 0; k < 8; k++) {
      const nx = ix + DX[k];
      const ny = iy + DY[k];
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const j = ny * size + nx;
      if (ocean[j] || lake[j] > 0) continue;
      const slope = Math.abs(height[j] - height[i]) / DIST[k];
      let c = DIST[k] * (1 + slope * 45 + vegetation[j] * 0.6);
      if (water[j] > thr) c += 8; // 橋
      if (road[j] > 0) c *= 0.3;
      const nd = d + c;
      if (nd < dist[j]) {
        dist[j] = nd;
        prev[j] = i;
        heap.push(nd, j);
      }
    }
  }
  if (dist[goal] === Infinity) return;
  for (let i = goal; i !== -1; i = prev[i]) road[i] = 1;
}
