import type { ContourStroke } from '../types/world.ts';
import { rasterizeStroke } from './contour.ts';
import { collectSeeds, interpolateHeight } from './interpolation.ts';
import { addFractalNoise } from './noise.ts';
import { smoothHeight } from './smoothing.ts';
import { smoothstep } from '../utils/math.ts';

export type TerrainOptions = {
  size: number;
  seed: number;
  noiseStrength?: number;
  smoothPasses?: number;
};

/**
 * 等高線 → 高さマップ。
 * ラスタライズ → 補間 → ノイズ → 平滑化 の順で、同じシードなら同じ地形になる。
 */
export function generateHeightfield(
  strokes: ContourStroke[],
  opts: TerrainOptions
): Float32Array {
  const { size, seed } = opts;
  const noiseStrength = opts.noiseStrength ?? 0.05;
  const smoothPasses = opts.smoothPasses ?? 5;
  const height = new Float32Array(size * size);
  const mask = new Uint8Array(size * size);

  for (const s of strokes) rasterizeStroke(s, height, mask, size);
  const target = new Float32Array(height); // 線上のセルの目標標高
  const seeds = collectSeeds(height, mask, size);
  interpolateHeight(height, mask, size, seeds);

  if (strokes.length > 0) {
    addFractalNoise(height, size, size / 7, 5, seed, noiseStrength);
    smoothHeight(height, size, smoothPasses);
    // 平滑化で線が溶けないよう、描いた高さを半分だけ思い出させる
    for (let i = 0; i < height.length; i++) {
      if (mask[i]) height[i] = height[i] * 0.5 + target[i] * 0.5;
    }
    smoothHeight(height, size, 2);
  }

  // 地図の端をなだらかに海へ落とす
  const fade = size * 0.045;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.min(x, y, size - 1 - x, size - 1 - y);
      const f = smoothstep(0, fade, d);
      const i = y * size + x;
      height[i] = Math.min(1, Math.max(0, height[i] * (0.15 + 0.85 * f)));
    }
  }
  return height;
}
