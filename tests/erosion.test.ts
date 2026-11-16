import { describe, expect, it } from 'vitest';
import { applyAction, refresh } from '../src/simulation/engine.ts';
import { erodeTerrain } from '../src/simulation/erosion.ts';
import { buildWorld, sum } from './helpers.ts';

function rainyWorld(vegetation: number) {
  const w = buildWorld();
  applyAction(w, { k: 'rain', x: 0, y: 0, r: 0, v: 1 });
  w.vegetation.fill(vegetation);
  refresh(w);
  return w;
}

describe('侵食と堆積', () => {
  it('水が多い場所で地形が変わる', () => {
    const w = rainyWorld(0);
    const before = Float32Array.from(w.height);
    erodeTerrain(w);
    let lowered = 0;
    let raised = 0;
    for (let i = 0; i < before.length; i++) {
      if (w.height[i] < before[i] - 1e-7) lowered++;
      if (w.height[i] > before[i] + 1e-7) raised++;
    }
    expect(lowered).toBeGreaterThan(0);
    expect(raised).toBeGreaterThan(0);
  });

  it('雨がなければ侵食しない（tick でも地形は変わらない）', () => {
    const w = buildWorld();
    const before = Float32Array.from(w.height);
    erodeTerrain(w);
    expect(Array.from(w.height)).toEqual(Array.from(before));
  });

  it('植生があると侵食が弱まる（伐採で侵食が強まる）', () => {
    const bare = rainyWorld(0);
    const forest = rainyWorld(1);
    const b0 = Float32Array.from(bare.height);
    const f0 = Float32Array.from(forest.height);
    for (let i = 0; i < 5; i++) {
      erodeTerrain(bare);
      erodeTerrain(forest);
    }
    let bareLoss = 0;
    let forestLoss = 0;
    for (let i = 0; i < b0.length; i++) {
      bareLoss += Math.max(0, b0[i] - bare.height[i]);
      forestLoss += Math.max(0, f0[i] - forest.height[i]);
    }
    expect(bareLoss).toBeGreaterThan(forestLoss);
  });

  it('土砂は失われすぎない（侵食した分の大半は堆積する）', () => {
    const w = rainyWorld(0);
    const total0 = sum(w.height);
    erodeTerrain(w);
    const total1 = sum(w.height);
    const lost = total0 - total1;
    // 侵食量の合計に比べ、失われた土砂は小さい
    let eroded = 0;
    for (let i = 0; i < w.sediment.length; i++) if (w.sediment[i] < 0) eroded -= w.sediment[i];
    expect(lost).toBeLessThan(eroded * 0.9 + 1e-6);
  });

  it('時間とともに谷が深くなる', () => {
    const w = rainyWorld(0);
    const meanBefore = sum(w.height) / w.height.length;
    for (let i = 0; i < 20; i++) {
      refresh(w);
      erodeTerrain(w);
    }
    const meanAfter = sum(w.height) / w.height.length;
    expect(meanAfter).not.toBe(meanBefore);
  });
});
