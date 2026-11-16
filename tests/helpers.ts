import type { ContourStroke, World } from '../src/types/world.ts';
import { createWorld, refresh, setStrokes } from '../src/simulation/engine.ts';

export function ring(cx: number, cy: number, r: number, elevation: number, width = 0.03, id = 'r'): ContourStroke {
  const points = [];
  for (let k = 0; k <= 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    points.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return { id, points, elevation, width };
}

/** 中央に山がある島 */
export function islandStrokes(): ContourStroke[] {
  return [
    ring(0.5, 0.5, 0.26, 0.28, 0.03, 'foot'),
    ring(0.48, 0.5, 0.15, 0.55, 0.03, 'mid'),
    ring(0.46, 0.5, 0.06, 0.85, 0.03, 'peak'),
  ];
}

export function buildWorld(size = 96, seed = 7, strokes = islandStrokes()): World {
  const w = createWorld(size, seed);
  setStrokes(w, strokes);
  return w;
}

/** 手で作った地形に差し替えて、派生量を再計算する */
export function withHeight(size: number, fn: (x: number, y: number) => number, rainfall = 1): World {
  const w = createWorld(size, 1);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) w.height[y * size + x] = fn(x, y);
  w.rainfall = rainfall;
  refresh(w);
  return w;
}

export function count(arr: ArrayLike<number>, pred: (v: number) => boolean): number {
  let c = 0;
  for (let i = 0; i < arr.length; i++) if (pred(arr[i])) c++;
  return c;
}

export function sum(arr: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s;
}
