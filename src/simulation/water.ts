import type { World } from '../types/world.ts';
import { MinHeap } from '../utils/heap.ts';
import { DX, DY, DIST } from '../utils/math.ts';
import { budykoRunoff } from './climate.ts';
import { EPS, LAKE_LOSS, LAKE_MIN_DEPTH, LAKE_MIN_INFLOW } from './constants.ts';

/** 川の閾値（降雨量が多いほど細い流れも川になる） */
export function riverThreshold(world: World): number {
  return 40 / Math.max(0.25, Math.min(2.5, world.rainfall || 1));
}

/**
 * 水循環の計算。
 *
 * 1. Priority-Flood で窪地を水面まで埋める（窪地は湖の候補になる）
 * 2. 各セルの流れ先を、埋めた後の面で最も急な下り隣接セルにする
 * 3. 下流から上流へ降水を足し込んで集水量（= 流量）を出す
 * 4. 湖は流入量が足りるときだけ水を湛える
 *
 * 雨のあと水が谷に集まって川になり、盆地には湖ができ、ダムの上流には湖ができる。
 */
export function computeHydrology(world: World): void {
  const { size, height, dam, precip, vegetation, water, lake } = world;
  const n = size * size;
  const { filled, receiver, order, ocean } = world.hydro;
  const seaLevel = world.seaLevel;

  const surface = new Float32Array(n);
  for (let i = 0; i < n; i++) surface[i] = height[i] + dam[i];

  const visited = new Uint8Array(n);
  const parent = new Int32Array(n).fill(-1);
  const heap = new MinHeap(n);

  for (let i = 0; i < n; i++) ocean[i] = height[i] < seaLevel ? 1 : 0;

  // 排水口 = 海セルと地図の端
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const edge = x === 0 || y === 0 || x === size - 1 || y === size - 1;
      if (ocean[i] || edge) {
        visited[i] = 1;
        filled[i] = surface[i];
        heap.push(surface[i], i);
      }
    }
  }

  let count = 0;
  while (heap.size > 0) {
    const i = heap.pop();
    order[count++] = i;
    const ix = i % size;
    const iy = (i - ix) / size;
    for (let d = 0; d < 8; d++) {
      const nx = ix + DX[d];
      const ny = iy + DY[d];
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const j = ny * size + nx;
      if (visited[j]) continue;
      visited[j] = 1;
      parent[j] = i;
      const level = filled[i] + EPS;
      filled[j] = surface[j] > level ? surface[j] : level;
      heap.push(filled[j], j);
    }
  }

  // 流れ先: 埋めた後の面で最も急に下る隣接セル（見つからなければ親）
  for (let k = 0; k < count; k++) {
    const i = order[k];
    if (parent[i] === -1) {
      receiver[i] = -1;
      continue;
    }
    const ix = i % size;
    const iy = (i - ix) / size;
    let best = parent[i];
    let bestSlope = -1;
    for (let d = 0; d < 8; d++) {
      const nx = ix + DX[d];
      const ny = iy + DY[d];
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const j = ny * size + nx;
      const drop = filled[i] - filled[j];
      if (drop <= 0) continue;
      const slope = drop / DIST[d];
      if (slope > bestSlope) {
        bestSlope = slope;
        best = j;
      }
    }
    receiver[i] = best;
  }

  // 湖の深さ（窪地を埋めた量）
  const depth = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const dpt = filled[i] - surface[i];
    depth[i] = !ocean[i] && dpt > LAKE_MIN_DEPTH ? dpt : 0;
  }

  // 流量 = 上流の降水の合計（植生が多いほど浸透して流出が減る）
  const runoff = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    runoff[i] = budykoRunoff(precip[i], world.temperature[i], vegetation[i]) / 1000;
    water[i] = runoff[i];
  }
  for (let k = count - 1; k >= 0; k--) {
    const i = order[k];
    const r = receiver[i];
    if (r >= 0) water[r] += water[i] * (depth[i] > 0 ? LAKE_LOSS : 1);
  }

  // 湖: 窪地ごとに、流域全体からの流入量が足りるときだけ水を湛える
  // （水面は平らなので、窪地を 1 つのまとまりとして数える）
  const label = new Int32Array(n).fill(-1);
  const stack: number[] = [];
  const members: number[] = [];
  lake.fill(0);
  for (let s0 = 0; s0 < n; s0++) {
    if (depth[s0] <= 0 || label[s0] !== -1) continue;
    members.length = 0;
    label[s0] = s0;
    stack.push(s0);
    let inflow = 0;
    while (stack.length) {
      const i = stack.pop()!;
      members.push(i);
      inflow += runoff[i];
      const ix = i % size;
      const iy = (i - ix) / size;
      for (let d = 0; d < 8; d++) {
        const nx = ix + DX[d];
        const ny = iy + DY[d];
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const j = ny * size + nx;
        if (depth[j] > 0 && label[j] === -1) {
          label[j] = s0;
          stack.push(j);
        }
      }
    }
    // 窪地の外から流れ込む水
    for (const i of members) {
      const ix = i % size;
      const iy = (i - ix) / size;
      for (let d = 0; d < 8; d++) {
        const nx = ix + DX[d];
        const ny = iy + DY[d];
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const j = ny * size + nx;
        if (label[j] !== s0 && receiver[j] === i) inflow += water[j];
      }
    }
    if (inflow >= LAKE_MIN_INFLOW) for (const i of members) lake[i] = depth[i];
  }
}

export function computeRiverMask(water: Float32Array, threshold: number): Uint8Array {
  const mask = new Uint8Array(water.length);
  for (let i = 0; i < water.length; i++) mask[i] = water[i] > threshold ? 1 : 0;
  return mask;
}

/** 川幅 = log(1 + 蓄積量) */
export function riverWidth(flow: number): number {
  return Math.log(1 + flow) * 0.35;
}

export function computeOceanMask(height: Float32Array, seaLevel: number): Uint8Array {
  const mask = new Uint8Array(height.length);
  for (let i = 0; i < height.length; i++) mask[i] = height[i] < seaLevel ? 1 : 0;
  return mask;
}

export function isRiver(world: World, i: number, threshold: number): boolean {
  return world.water[i] > threshold && !world.hydro.ocean[i] && world.lake[i] === 0;
}

/** 最寄りの水域（海・湖・川）までの距離をチャンファー変換で求める */
export function computeWaterDistance(world: World): void {
  const { size, waterDist, lake, water } = world;
  const ocean = world.hydro.ocean;
  const thr = riverThreshold(world);
  const BIG = 1e6;
  for (let i = 0; i < waterDist.length; i++) {
    const wet = ocean[i] || lake[i] > 0 || (water[i] > thr && world.rainfall > 0);
    waterDist[i] = wet ? 0 : BIG;
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      let v = waterDist[i];
      if (x > 0) v = Math.min(v, waterDist[i - 1] + 1);
      if (y > 0) {
        v = Math.min(v, waterDist[i - size] + 1);
        if (x > 0) v = Math.min(v, waterDist[i - size - 1] + Math.SQRT2);
        if (x < size - 1) v = Math.min(v, waterDist[i - size + 1] + Math.SQRT2);
      }
      waterDist[i] = v;
    }
  }
  for (let y = size - 1; y >= 0; y--) {
    for (let x = size - 1; x >= 0; x--) {
      const i = y * size + x;
      let v = waterDist[i];
      if (x < size - 1) v = Math.min(v, waterDist[i + 1] + 1);
      if (y < size - 1) {
        v = Math.min(v, waterDist[i + size] + 1);
        if (x < size - 1) v = Math.min(v, waterDist[i + size + 1] + Math.SQRT2);
        if (x > 0) v = Math.min(v, waterDist[i + size - 1] + Math.SQRT2);
      }
      waterDist[i] = v;
    }
  }
}
