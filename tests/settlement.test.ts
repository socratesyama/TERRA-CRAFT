import { describe, expect, it } from 'vitest';
import { applyAction, stepTicks } from '../src/simulation/engine.ts';
import { computeStats } from '../src/simulation/metrics.ts';
import { count } from './helpers.ts';
import { buildWorld } from './helpers.ts';

function grownWorld(ticks = 80) {
  const w = buildWorld(96);
  applyAction(w, { k: 'rain', x: 0, y: 0, r: 0, v: 1.1 });
  stepTicks(w, ticks);
  return w;
}

describe('集落と文明', () => {
  it('雨がなければ集落は生まれない', () => {
    const w = buildWorld(96);
    stepTicks(w, 40);
    expect(w.settlements.length).toBe(0);
  });

  it('水と平地のある場所に集落が発生する', () => {
    const w = grownWorld();
    expect(w.settlements.length).toBeGreaterThan(0);
    for (const s of w.settlements) {
      const i = s.y * w.size + s.x;
      expect(w.hydro.ocean[i]).toBe(0);
      expect(w.lake[i]).toBe(0);
      expect(w.waterDist[i]).toBeLessThan(25);
      expect(w.height[i]).toBeGreaterThan(w.seaLevel);
    }
  });

  it('集落同士は一定の間隔を保つ', () => {
    const w = grownWorld();
    for (const a of w.settlements) {
      for (const b of w.settlements) {
        if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it('人口が増え、集計が一致する', () => {
    const w = grownWorld(120);
    const stats = computeStats(w);
    const sum = w.settlements.reduce((m, s) => m + s.pop, 0);
    expect(stats.population).toBeGreaterThan(100);
    expect(Math.abs(stats.population - sum)).toBeLessThan(w.settlements.length + 1);
    expect(stats.settlements).toBe(w.settlements.length);
  });

  it('集落が複数あると道路が通る', () => {
    const w = grownWorld(120);
    if (w.settlements.length >= 2) expect(count(w.road, (v) => v > 0)).toBeGreaterThan(0);
  });

  it('人口が増えると農地が広がる', () => {
    const w = grownWorld(120);
    expect(computeStats(w).farmland).toBeGreaterThan(0);
  });

  it('イベントログに集落の発生が残る', () => {
    const w = grownWorld();
    expect(w.history.some((e) => e.kind === 'settlement')).toBe(true);
    expect(w.history.some((e) => e.kind === 'river')).toBe(true);
  });
});
