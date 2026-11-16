import type { World } from '../types/world.ts';
import { clamp } from '../utils/math.ts';
import { MAX_ELEVATION } from './constants.ts';

/** 飽和水蒸気圧 [hPa]（Magnus の式）。気温が 10°C 下がると空気が含める水蒸気はおよそ半分になる。 */
export function saturationVaporPressure(tC: number): number {
  return 6.112 * Math.exp((17.62 * tC) / (243.12 + tC));
}
const ES_REF = saturationVaporPressure(20);

/** 可能蒸発散量 PET [mm/年]。気温が高いほど大気の水分要求が大きい（気温法による近似）。 */
export function potentialEvapotranspiration(tC: number): number {
  return Math.max(20, 30 * tC + 120);
}

/**
 * Budyko 曲線（Zhang et al. 2001）による流出量 [mm/年]。
 *   ET = P (1 + w·PET/P) / (1 + w·PET/P + P/PET)
 *   流出 = P − ET
 * w は植生の水利用効率で、草地は約 0.5、森林は約 2.0。伐採すると蒸発散が減って流出が増える。
 */
export function budykoRunoff(precipMm: number, tC: number, vegetation: number): number {
  if (precipMm <= 0) return 0;
  const pet = potentialEvapotranspiration(tC);
  const w = 0.5 + 1.5 * vegetation;
  const x = pet / precipMm;
  const et = (precipMm * (1 + w * x)) / (1 + w * x + 1 / x);
  return Math.max(0, precipMm - et);
}

/**
 * 気温 [°C]
 *   北ほど寒く（緯度）、標高が上がるほど寒い（気温減率 6.5°C/km）。
 *   水域の近くは気温差が小さく（海洋性）、植生は蒸散でわずかに冷やす。
 */
export function computeTemperature(world: World): void {
  const { size, height, vegetation, temperature, waterDist } = world;
  for (let y = 0; y < size; y++) {
    const latitude = (y / (size - 1) - 0.5) * 8; // 南（下）ほど暖かい
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const elevM = Math.max(height[i], world.seaLevel) * MAX_ELEVATION;
      let t = 23 + world.temperatureBias + latitude - elevM * 0.0065;
      const wet = Math.exp(-waterDist[i] / 6);
      t += (16 - t) * 0.12 * wet;
      t -= vegetation[i] * 0.4;
      temperature[i] = t;
    }
  }
}

/**
 * 降水量 [mm/年]。西風が運ぶ水蒸気を、飽和水蒸気圧との差で雨に変える。
 *   - 海上では空気が蒸発で湿度 80% まで湿る
 *   - 山を登ると断熱冷却で飽和水蒸気圧が下がり、余った水蒸気が雨になる（風上斜面の地形性降雨）
 *   - 山を下ると断熱昇温で空気が乾く（雨蔭・フェーン）
 *   - 陸上では蒸散と湖面からの蒸発が空気に水を戻す
 */
export function computePrecipitation(world: World): void {
  const { size, lake, vegetation, precip, temperature } = world;
  const ocean = world.hydro.ocean;
  const rain = world.rainfall;
  for (let y = 0; y < size; y++) {
    let carried = 0.8; // 20°C の飽和量を 1 とした水蒸気量
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const cap = saturationVaporPressure(temperature[i]) / ES_REF;
      let fall = 0;
      let humidity = 0;
      if (ocean[i]) {
        const target = 0.92 * cap;
        if (carried < target) carried += (target - carried) * 0.35;
      } else {
        // 飽和に近づいた分が降水になる（相対湿度 88% で凝結が始まる）
        fall = Math.max(0, carried - 0.85 * cap) * 0.8;
        // 対流性・前線性の基本降水
        fall += carried * 0.035 * clamp((temperature[i] + 2) / 14, 0, 1);
        carried -= fall;
        carried += fall * 0.2; // 蒸発散による再循環
        // 相対湿度に応じた前線・対流性の降水（湿った空気ほど降る）
        humidity = clamp(carried / cap, 0, 1.2) * clamp((temperature[i] + 8) / 20, 0.15, 1);
        if (lake[i] > 0) carried += Math.max(0, 0.85 * cap - carried) * 0.15;
        else carried += (0.006 + 0.02 * vegetation[i]) * cap;
      }
      precip[i] = Math.min(4500, rain * (7500 * fall + 520 * humidity * humidity));
    }
  }
}

/** 地表の水分 0〜1。乾燥度指数 AI = P / PET（UNEP: 0.5 未満は乾燥地、0.65 未満は半乾燥地）に基づく。 */
export function computeMoisture(world: World): void {
  const { moisture, precip, waterDist, temperature, vegetation } = world;
  for (let i = 0; i < moisture.length; i++) {
    const ai = precip[i] / potentialEvapotranspiration(temperature[i]);
    const rainTerm = clamp(ai / 1.3, 0, 1) * 0.75;
    const riparian = Math.exp(-waterDist[i] / 5) * 0.4 * Math.min(1, world.rainfall);
    const retain = vegetation[i] * 0.08;
    moisture[i] = clamp(rainTerm + riparian + retain, 0, 1);
  }
}

/** 日照: 南西向きの斜面ほど明るい */
export function computeSunlight(world: World): void {
  const { size, height, sunlight } = world;
  const lx = 0.3;
  const ly = 0.6;
  const lz = 0.74;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const xl = height[y * size + Math.max(0, x - 1)];
      const xr = height[y * size + Math.min(size - 1, x + 1)];
      const yu = height[Math.max(0, y - 1) * size + x];
      const yd = height[Math.min(size - 1, y + 1) * size + x];
      const nx = -(xr - xl) * 9;
      const ny = -(yd - yu) * 9;
      const inv = 1 / Math.hypot(nx, ny, 1);
      const d = (nx * lx + ny * ly + lz) * inv;
      sunlight[i] = clamp(0.3 + d * 0.75, 0.15, 1);
    }
  }
}
