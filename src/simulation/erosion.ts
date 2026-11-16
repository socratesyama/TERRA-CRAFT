import type { World } from '../types/world.ts';

const K_EROSION = 0.0035;
const K_CAPACITY = 0.012;
const MAX_PER_TICK = 0.004;

/** 局所の傾斜（最大高低差） */
export function localSlope(height: Float32Array, x: number, y: number, size: number): number {
  const i = y * size + x;
  let m = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const d = Math.abs(height[i] - height[ny * size + nx]);
      if (d > m) m = d;
    }
  }
  return m;
}

/**
 * 侵食と堆積。
 *   侵食量 = k × √水量 × 勾配 × (1 − 0.7 × 植生)
 *   運べる土砂の量 = c × √水量 × 勾配
 * 上流から下流へ土砂を運び、運びきれない分をその場に堆積させる。
 * 湖では全量が沈み、河口では海側にも積もって三角州になる。
 */
export function erodeTerrain(world: World, strength = 1): void {
  const { size, height, water, lake, vegetation, sediment, dam } = world;
  const { order, receiver, ocean } = world.hydro;
  const n = size * size;
  const load = new Float32Array(n);
  const floor = world.seaLevel + 0.004;
  const k = K_EROSION * strength * world.erosionRate;

  for (let idx = n - 1; idx >= 0; idx--) {
    const i = order[idx];
    const r = receiver[i];
    if (r < 0 || ocean[i]) continue;

    const dh = height[i] + dam[i] - (height[r] + dam[r]);
    const rx = r % size;
    const ix = i % size;
    const dist = rx !== ix && Math.floor(r / size) !== Math.floor(i / size) ? Math.SQRT2 : 1;
    const slope = Math.max(0, dh) / dist;
    const q = Math.sqrt(water[i]);

    let eroded = 0;
    if (lake[i] === 0 && height[i] > floor) {
      eroded = Math.min(MAX_PER_TICK, k * q * slope * (1 - 0.7 * vegetation[i]));
      eroded = Math.min(eroded, height[i] - floor);
    }
    const capacity = K_CAPACITY * q * slope;
    let carried = load[i] + eroded;
    height[i] -= eroded;
    sediment[i] -= eroded;

    let deposit = 0;
    if (lake[i] > 0) deposit = carried;
    else if (ocean[r]) deposit = carried * 0.5;
    else deposit = Math.max(0, carried - capacity);
    if (deposit > 0) {
      height[i] += deposit;
      sediment[i] += deposit;
      carried -= deposit;
    }
    if (carried > 0) {
      if (ocean[r]) {
        // 河口の海側にも堆積して三角州を伸ばす
        height[r] += carried;
        sediment[r] += carried;
      } else {
        load[r] += carried;
      }
    }
  }
}

export function depositSediment(world: World, rate = 0.1): void {
  const { size, height, sediment } = world;
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = y * size + x;
      if (sediment[i] > 0) {
        const amount = sediment[i] * rate;
        height[i] += amount;
        sediment[i] -= amount;
      }
    }
  }
}
