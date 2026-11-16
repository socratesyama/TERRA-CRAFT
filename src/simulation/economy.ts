import type { Settlement, World } from '../types/world.ts';
import { localFlatness } from './metrics.ts';
import { riverThreshold } from './water.ts';

/**
 * 集落が養える人口（マルサス的な食料制約）。
 *   農業 = 周囲の耕作適地の生産力の合計（水分・日照・平坦さの積）
 *          河川の近くは灌漑と氾濫原の堆積土で生産力が上がる（ナイル・メソポタミア型）
 *   漁業 = 沿岸の海面の面積
 *   交易 = 市場アクセスが大きいほど、食料を輸入して人口を支えられる
 */
export function carryingCapacity(world: World, s: Settlement): number {
  const { size, height, moisture, sunlight, waterDist, lake, road } = world;
  const ocean = world.hydro.ocean;
  const R = 6;
  let fertile = 0;
  let roadNear = 0;
  let sea = 0;
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 > R * R) continue;
      const x = s.x + dx;
      const y = s.y + dy;
      if (x < 1 || y < 1 || x >= size - 1 || y >= size - 1) continue;
      const i = y * size + x;
      if (ocean[i]) {
        if (d2 <= 16) sea++;
        continue;
      }
      if (lake[i] > 0) continue;
      const flat = localFlatness(height, x, y, size);
      if (flat < 0.25) continue;
      const wd = waterDist[i];
      // 灌漑: 川や湖の近くでは、降水が少なくても水を引ける
      const irrigated = Math.max(moisture[i], 0.8 * Math.exp(-wd / 3) * Math.min(1, world.rainfall));
      // 氾濫原の沖積土は肥沃
      const alluvial = wd < 3 ? 1.35 : 1;
      fertile += irrigated * sunlight[i] * flat * alluvial;
      if (road[i] > 0) roadNear++;
    }
  }
  const wd = waterDist[s.y * size + s.x];
  const waterFactor = 0.45 + 0.55 * Math.exp(-wd / 4);
  const farming = 40 * fertile * waterFactor * (1 + Math.min(0.4, roadNear / 40));
  const fishing = 6 * sea;
  const tradeBoost = 1 + 0.5 * (s.market / (s.market + 800));
  return (30 + farming + fishing) * tradeBoost;
}

/** 人口に応じて集落の周囲に農地を広げる。農地は植生の上限を下げる（森が草地に変わる）。 */
export function updateFarmland(world: World): void {
  const { size, height, moisture, farm, road, lake, waterDist } = world;
  const ocean = world.hydro.ocean;
  farm.fill(0);
  for (const s of world.settlements) {
    if (s.pop < 60) continue;
    const R = Math.min(7, 2 + Math.floor(s.pop / 350));
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy > R * R) continue;
        const x = s.x + dx;
        const y = s.y + dy;
        if (x < 1 || y < 1 || x >= size - 1 || y >= size - 1) continue;
        const i = y * size + x;
        if (ocean[i] || lake[i] > 0 || road[i] > 0) continue;
        const wet = Math.max(moisture[i], 0.8 * Math.exp(-waterDist[i] / 3));
        if (wet < 0.3) continue;
        if (localFlatness(height, x, y, size) < 0.45) continue;
        farm[i] = 1;
      }
    }
  }
}

/**
 * 輸送費。陸路は傾斜と水域で高くなり、道路があれば安くなる。
 * 港どうしは海路で結べて、距離あたりの費用は陸路の約 3 分の 1（水運の費用優位）。
 */
export function transportCost(world: World, a: Settlement, b: Settlement): number {
  const { size, height, road, lake, water } = world;
  const ocean = world.hydro.ocean;
  const thr = riverThreshold(world);
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(d / 2));
  let land = 0;
  let prevH = height[a.y * size + a.x];
  for (let k = 1; k <= steps; k++) {
    const t = k / steps;
    const x = Math.round(a.x + (b.x - a.x) * t);
    const y = Math.round(a.y + (b.y - a.y) * t);
    const i = y * size + x;
    let c = 1 + 40 * Math.abs(height[i] - prevH);
    if (ocean[i] || lake[i] > 0) c += 8;
    else if (water[i] > thr) c += 1.5;
    if (road[i] > 0) c *= 0.35;
    land += c * (d / steps);
    prevH = height[i];
  }
  const sea = a.port && b.port ? 0.3 * d + 4 : Infinity;
  return Math.min(land, sea);
}

/**
 * 経済規模と交易（新経済地理学・重力モデル）。
 *   市場アクセス M_i = Σ_j GDP_j / (1 + 輸送費_ij / 10)²
 *   生産性 = 1 + 0.8 M / (M + 400)（市場が大きいほど分業が進み、生産性が上がる）
 *   GDP_i = 人口 × 生産性
 *   交易量 T_ij ∝ GDP_i GDP_j / 輸送費²
 */
export function computeEconomy(world: World): void {
  const list = world.settlements;
  const { size } = world;
  const ocean = world.hydro.ocean;
  for (const s of list) {
    let coastal = false;
    for (let dy = -3; dy <= 3 && !coastal; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const x = s.x + dx;
        const y = s.y + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        if (ocean[y * size + x]) {
          coastal = true;
          break;
        }
      }
    }
    s.port = coastal;
  }
  let trade = 0;
  const gdpPrev = list.map((s) => (s.gdp > 0 ? s.gdp : s.pop));
  for (let i = 0; i < list.length; i++) {
    let m = 0;
    for (let j = 0; j < list.length; j++) {
      if (i === j) continue;
      const c = transportCost(world, list[i], list[j]);
      const f = 1 / Math.pow(1 + c / 10, 2);
      m += gdpPrev[j] * f;
      if (j > i) trade += gdpPrev[i] * gdpPrev[j] * f * f * 0.0004;
    }
    list[i].market = m;
    list[i].gdp = list[i].pop * (1 + (0.8 * m) / (m + 400));
  }
  world.memo.trade = trade;
}
