import { Biome } from '../types/world.ts';
import type { World } from '../types/world.ts';
import { clamp, smoothstep } from '../utils/math.ts';

/** 草食動物の環境収容力 K [頭/km²]。餌（植生）・水場への近さ・人間活動で決まる。 */
export function herbivoreCapacity(world: World, i: number): number {
  const b = world.biome[i];
  if (b === Biome.Ocean || b === Biome.Lake || b === Biome.River || b === Biome.Snow) return 0;
  if (world.temperature[i] < -6 || world.height[i] > 0.85) return 0;
  const v = world.vegetation[i];
  // 草食獣は草地と疎林で最も多く、密な森林では下層の草が少なくなる
  const forage = v * (1 - 0.4 * smoothstep(0.6, 1, v));
  // 毎日水を飲む必要があり、水場から離れるほど生息できない
  const water = Math.exp(-world.waterDist[i] / 12) * Math.min(1, world.rainfall * 2);
  // 農地・道路による生息地の消失と分断
  let human = 1;
  if (world.farm[i]) human = 0.2;
  else if (world.road[i] > 0) human = 0.8;
  if (world.settlement[i] > 0) human = 0;
  return 38 * forage * water * human;
}

const E_CONV = 0.12; // 捕食者の転換効率（栄養段階間でおよそ 10%）
const ATTACK = 0.04;
const MORT = 0.05;

/**
 * 動物の個体群動態。
 *  - 草食動物: ロジスティック成長 + 捕食による死亡
 *  - 捕食者: Lotka–Volterra（餌が閾値より多いときだけ増える）+ なわばりによる自己制限
 *  - 移動: 理想自由分布（Ideal Free Distribution）。資源あたりの密度が高い所から低い所へ流れ、
 *    結果として動物は餌と水のある場所に集まる。質量は保存される。
 */
export function updateFauna(world: World): void {
  const { size, herb, pred } = world;
  const n = size * size;
  const K = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    K[i] = herbivoreCapacity(world, i);
    let h = herb[i];
    let p = pred[i];
    if (K[i] < 0.05) {
      h *= 0.6;
      p *= 0.6;
    } else {
      h += 0.5 * h * (1 - h / K[i]) + 0.004 * K[i]; // 増殖 + 周辺からの侵入
      h -= ATTACK * h * p;
      p += p * (E_CONV * ATTACK * h - MORT) - 0.02 * p * p;
      if (h > 12) p += 0.0005 * h;
    }
    herb[i] = Math.max(0, h);
    pred[i] = Math.max(0, p);
  }

  diffuseIFD(herb, K, size, 0.12);
  const Kp = new Float32Array(n);
  for (let i = 0; i < n; i++) Kp[i] = Math.max(0.0001, herb[i] * 0.15);
  diffuseIFD(pred, Kp, size, 0.08);
}

/** フラックス = D √(K_i K_j) (ρ_i − ρ_j)、ρ = 密度 / 収容力。対ごとに逆向きに足し引きするので総数は変わらない。 */
export function diffuseIFD(field: Float32Array, K: Float32Array, size: number, D: number): void {
  const delta = new Float32Array(field.length);
  const rho = new Float32Array(field.length);
  for (let i = 0; i < field.length; i++) rho[i] = K[i] > 0.05 ? field[i] / K[i] : 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      for (const j of [x < size - 1 ? i + 1 : -1, y < size - 1 ? i + size : -1]) {
        if (j < 0) continue;
        let flux = D * Math.sqrt(K[i] * K[j]) * (rho[i] - rho[j]);
        flux = clamp(flux, -field[j] * 0.25, field[i] * 0.25);
        delta[i] -= flux;
        delta[j] += flux;
      }
    }
  }
  for (let i = 0; i < field.length; i++) field[i] = Math.max(0, field[i] + delta[i]);
}
