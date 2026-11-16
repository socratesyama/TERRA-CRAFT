import { Biome } from '../types/world.ts';
import type { World } from '../types/world.ts';
import { clamp } from '../utils/math.ts';
import { riverThreshold } from './water.ts';

/** 温度適合度 0〜1（12〜26°C が最適） */
export function temperatureSuitability(t: number): number {
  if (t <= -2 || t >= 42) return 0;
  if (t < 12) return (t + 2) / 14;
  if (t <= 26) return 1;
  return (42 - t) / 16;
}

/**
 * 純一次生産量 NPP [g/m²/年]（Miami モデル, Lieth 1975）。
 * 気温と降水量のうち、より制限的な方で決まる（リービッヒの最小律）。
 *   NPP_T = 3000 / (1 + exp(1.315 − 0.119 T))
 *   NPP_P = 3000 (1 − exp(−0.000664 P))
 */
export function netPrimaryProductivity(tC: number, precipMm: number): number {
  const byT = 3000 / (1 + Math.exp(1.315 - 0.119 * tC));
  const byP = 3000 * (1 - Math.exp(-0.000664 * Math.max(0, precipMm)));
  return Math.min(byT, byP);
}

/**
 * 植生の成長。
 *   成長 = 水分 × 0.5 + 日照 × 0.3 + 温度適合度 × 0.2
 * 環境が許す上限（水分と気温で決まる）まで近づく。周囲に植生があるほど早く広がる。
 * 上限を下回る環境（干ばつ・寒冷化）では少しずつ枯れていく。
 */
export function growVegetation(world: World): void {
  const { size, moisture, vegetation, temperature, sunlight, farm, lake } = world;
  const ocean = world.hydro.ocean;
  const next = new Float32Array(vegetation.length);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (ocean[i] || lake[i] > 0) {
        next[i] = 0;
        continue;
      }
      const suit = temperatureSuitability(temperature[i]);
      const growth = moisture[i] * 0.5 + sunlight[i] * 0.3 + suit * 0.2;
      // 河川・湖の近くは地下水と氾濫原の水で、降水量以上の水が使える
      const peff =
        world.precip[i] + 450 * Math.exp(-world.waterDist[i] / 3) * Math.min(1, world.rainfall);
      let cap = clamp(netPrimaryProductivity(temperature[i], peff) / 1500, 0, 1) * (0.85 + 0.15 * sunlight[i]);
      if (farm[i]) cap = Math.min(cap, 0.3);

      // 周囲の種子供給
      let s = 0;
      let c = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          s += vegetation[ny * size + nx];
          c++;
        }
      }
      const seed = Math.max(s / Math.max(1, c), 0.1);

      const v = vegetation[i];
      if (cap > v) {
        next[i] = Math.min(1, v + (cap - v) * world.vegetationGrowthRate * (0.25 + 0.75 * growth) * (0.3 + seed));
      } else {
        next[i] = Math.max(0, v - (v - cap) * 0.12);
      }
    }
  }
  vegetation.set(next);
}

/** 植生・水分・標高・気温からバイオームを分類する */
export function classifyBiomes(world: World): void {
  const { size, height, moisture, vegetation, temperature, biome, lake, water, farm } = world;
  const ocean = world.hydro.ocean;
  const thr = riverThreshold(world);
  const sea = world.seaLevel;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (ocean[i]) {
        biome[i] = Biome.Ocean;
        continue;
      }
      if (lake[i] > 0) {
        biome[i] = Biome.Lake;
        continue;
      }
      if (world.rainfall > 0 && water[i] > thr) {
        biome[i] = Biome.River;
        continue;
      }
      const h = height[i];
      const t = temperature[i];
      if (t < -3) biome[i] = Biome.Snow;
      else if (h > 0.72 || t < 2) biome[i] = Biome.Alpine;
      else if (h > 0.55 && vegetation[i] < 0.4) biome[i] = Biome.Mountain;
      else if (h < sea + 0.05 && moisture[i] > 0.7 && vegetation[i] > 0.2) biome[i] = Biome.Wetland;
      else if (h < sea + 0.035) biome[i] = Biome.Coast;
      else if (farm[i]) biome[i] = Biome.Grassland;
      else if (vegetation[i] >= 0.5) biome[i] = Biome.Forest;
      else if (vegetation[i] >= 0.16) biome[i] = Biome.Grassland;
      else if (moisture[i] < 0.35) biome[i] = Biome.Desert;
      else biome[i] = Biome.Grassland;
    }
  }
}
