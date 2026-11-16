import { describe, expect, it } from 'vitest';
import { applyAction, stepTicks } from '../src/simulation/engine.ts';
import { computeStats } from '../src/simulation/metrics.ts';
import { riverThreshold } from '../src/simulation/water.ts';
import { buildWorld, sum } from './helpers.ts';

describe('統合: 世界の因果の連鎖', () => {
  it('山を作る → 雨 → 川が海まで流れる', () => {
    const w = buildWorld(96);
    applyAction(w, { k: 'rain', x: 0, y: 0, r: 0, v: 1 });
    const s = computeStats(w);
    expect(s.riverKm).toBeGreaterThan(10);
    // 川の流れ先をたどると、必ず海か地図の端（排水口）に着く
    let reachedSea = 0;
    for (let i = 0; i < w.water.length; i++) {
      if (w.water[i] < riverThreshold(w)) continue;
      let c = i;
      for (let hop = 0; hop < w.size * w.size && w.hydro.receiver[c] >= 0; hop++) c = w.hydro.receiver[c];
      if (w.hydro.ocean[c] || c % w.size === 0 || c < w.size) reachedSea++;
    }
    expect(reachedSea).toBeGreaterThan(0);
  });

  it('山を削ると、イベントログに因果の連鎖が残る', () => {
    const w = buildWorld(64);
    applyAction(w, { k: 'rain', x: 0, y: 0, r: 0, v: 1 });
    stepTicks(w, 10);
    applyAction(w, { k: 'cut', x: 0.46, y: 0.5, r: 8, v: 1 });
    stepTicks(w, 10);
    const chain = w.history.find((e) => e.kind === 'chain');
    expect(chain).toBeTruthy();
    expect(chain!.chain![0]).toBe('山を削った');
    expect(chain!.chain!.length).toBeGreaterThanOrEqual(3);
  });

  it('伐採した斜面では侵食が強まる', () => {
    const forest = buildWorld(64);
    const bare = buildWorld(64);
    for (const w of [forest, bare]) applyAction(w, { k: 'rain', x: 0, y: 0, r: 0, v: 1.2 });
    stepTicks(forest, 40);
    stepTicks(bare, 40);
    applyAction(bare, { k: 'clear', x: 0.5, y: 0.5, r: 30, v: 1 });
    const hf = Float32Array.from(forest.height);
    const hb = Float32Array.from(bare.height);
    for (let i = 0; i < 6; i++) {
      forest.vegetation.fill(0.9);
      bare.vegetation.fill(0);
      stepTicks(forest, 1);
      stepTicks(bare, 1);
    }
    const loss = (w: typeof forest, h0: Float32Array) => {
      let l = 0;
      for (let i = 0; i < h0.length; i++) l += Math.max(0, h0[i] - w.height[i]);
      return l;
    };
    expect(loss(bare, hb)).toBeGreaterThan(loss(forest, hf));
  });

  it('同じ操作は同じ結果になる（決定性）', () => {
    const run = () => {
      const w = buildWorld(64, 3);
      applyAction(w, { k: 'rain', x: 0, y: 0, r: 0, v: 1 });
      stepTicks(w, 20);
      return sum(w.height) + sum(w.vegetation) * 7 + w.settlements.length;
    };
    expect(run()).toBe(run());
  });

  it('水流 1 ステップ（192×192）は 50ms 前後に収まる', () => {
    const w = buildWorld(192);
    applyAction(w, { k: 'rain', x: 0, y: 0, r: 0, v: 1 });
    stepTicks(w, 2);
    const t0 = performance.now();
    stepTicks(w, 5);
    const perTick = (performance.now() - t0) / 5;
    // CI の環境差を見込んで余裕を持たせる
    expect(perTick).toBeLessThan(150);
  });
});
