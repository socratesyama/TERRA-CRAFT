import type { Action, World } from '../types/world.ts';
import { clamp } from '../utils/math.ts';
import { DX, DY } from '../utils/math.ts';

function forEachInRadius(
  world: World,
  cx: number,
  cy: number,
  r: number,
  fn: (i: number, f: number) => void
): void {
  const { size } = world;
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(size - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(size - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > r) continue;
      const t = 1 - d / r;
      fn(y * size + x, t * t * (3 - 2 * t));
    }
  }
}

/** 干渉の効果だけを適用する（記録と再計算は engine 側）。 */
export function applyTool(world: World, a: Action): void {
  const { size } = world;
  const cx = a.x * (size - 1);
  const cy = a.y * (size - 1);
  const v = a.v ?? 1;
  const ocean = world.hydro.ocean;

  switch (a.k) {
    case 'cut':
      forEachInRadius(world, cx, cy, a.r, (i, f) => {
        if (ocean[i]) return;
        const floor = world.seaLevel + 0.02;
        world.height[i] = Math.max(Math.min(world.height[i], floor), world.height[i] - 0.07 * v * f);
      });
      break;
    case 'raise':
      forEachInRadius(world, cx, cy, a.r, (i, f) => {
        world.height[i] = Math.min(1, world.height[i] + 0.07 * v * f);
      });
      break;
    case 'clear':
      forEachInRadius(world, cx, cy, a.r, (i, f) => {
        world.vegetation[i] *= 1 - 0.95 * f;
      });
      break;
    case 'plant':
      forEachInRadius(world, cx, cy, a.r, (i, f) => {
        if (ocean[i] || world.lake[i] > 0) return;
        world.vegetation[i] = Math.max(world.vegetation[i], 0.55 * f);
      });
      break;
    case 'reclaim':
      forEachInRadius(world, cx, cy, a.r, (i, f) => {
        if (f < 0.15) return;
        if (ocean[i]) {
          world.height[i] = Math.max(world.height[i], world.seaLevel + 0.025);
          world.vegetation[i] = 0;
        } else if (world.lake[i] > 0) {
          world.height[i] += world.lake[i] + 0.004;
          world.vegetation[i] = 0;
        }
      });
      break;
    case 'dam':
      buildDam(world, cx, cy);
      break;
    case 'rain':
      world.rainfall = clamp(v, 0, 3);
      break;
    case 'temp':
      world.temperatureBias = clamp(v, -12, 12);
      break;
  }
}

/** 近くの流量が最大のセルを探し、流れに直交する壁を谷の幅いっぱいに築く。 */
function buildDam(world: World, cx: number, cy: number): void {
  const { size, height, water, dam } = world;
  const { receiver } = world.hydro;
  let bx = Math.round(cx);
  let by = Math.round(cy);
  let bestFlow = -1;
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const x = Math.round(cx) + dx;
      const y = Math.round(cy) + dy;
      if (x < 1 || y < 1 || x >= size - 1 || y >= size - 1) continue;
      const q = water[y * size + x];
      if (q > bestFlow) {
        bestFlow = q;
        bx = x;
        by = y;
      }
    }
  }
  const c = by * size + bx;
  let fx = 0;
  let fy = 1;
  const r = receiver[c];
  if (r >= 0) {
    fx = (r % size) - bx;
    fy = Math.floor(r / size) - by;
  } else {
    let low = height[c];
    for (let d = 0; d < 8; d++) {
      const x = bx + DX[d];
      const y = by + DY[d];
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      if (height[y * size + x] < low) {
        low = height[y * size + x];
        fx = DX[d];
        fy = DY[d];
      }
    }
  }
  const len = Math.hypot(fx, fy) || 1;
  const px = -fy / len;
  const py = fx / len;
  const crest = height[c] + 0.05;
  for (const sgn of [1, -1]) {
    for (let k = 0; k <= 18; k++) {
      if (k === 0 && sgn === -1) continue;
      const x = Math.round(bx + sgn * k * px);
      const y = Math.round(by + sgn * k * py);
      if (x < 1 || y < 1 || x >= size - 1 || y >= size - 1) break;
      const i = y * size + x;
      if (k > 0 && height[i] >= crest) break;
      const add = crest - height[i];
      if (add > dam[i]) dam[i] = add;
      // 壁に厚みを持たせて、斜めの隙間から水が抜けないようにする
      for (const [ox, oy] of [[1, 0], [0, 1]] as const) {
        const j = (y + oy) * size + (x + ox);
        if (j < size * size) {
          const addJ = crest - height[j];
          if (addJ > dam[j]) dam[j] = addJ;
        }
      }
    }
  }
}
