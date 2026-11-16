import { describe, expect, it } from 'vitest';
import { applyAction, stepTicks } from '../src/simulation/engine.ts';
import { temperatureSuitability } from '../src/simulation/ecology.ts';
import { Biome } from '../src/types/world.ts';
import { computeStats } from '../src/simulation/metrics.ts';
import { buildWorld, count, sum } from './helpers.ts';

describe('生態系', () => {
  it('温度適合度は最適帯で 1、極端な寒暑で 0', () => {
    expect(temperatureSuitability(20)).toBe(1);
    expect(temperatureSuitability(-10)).toBe(0);
    expect(temperatureSuitability(50)).toBe(0);
    expect(temperatureSuitability(5)).toBeGreaterThan(0);
    expect(temperatureSuitability(5)).toBeLessThan(1);
  });

  it('雨がなければ植生は育たない', () => {
    const w = buildWorld(64);
    stepTicks(w, 20);
    expect(sum(w.vegetation)).toBe(0);
  });

  it('雨が降ると森林・草原が育つ', () => {
    const w = buildWorld(64);
    applyAction(w, { k: 'rain', x: 0, y: 0, r: 0, v: 1 });
    stepTicks(w, 40);
    const s = computeStats(w);
    expect(s.forest + s.grass).toBeGreaterThan(10);
    expect(count(w.biome, (b) => b === Biome.Forest)).toBeGreaterThan(0);
  });

  it('伐採すると植生が減り、植林すると増える', () => {
    const w = buildWorld(64);
    applyAction(w, { k: 'rain', x: 0, y: 0, r: 0, v: 1.2 });
    stepTicks(w, 40);
    const i = 32 * 64 + 20;
    const grown = w.vegetation[i];
    applyAction(w, { k: 'clear', x: 20 / 63, y: 32 / 63, r: 6, v: 1 });
    expect(w.vegetation[i]).toBeLessThan(grown);
    const cleared = w.vegetation[i];
    applyAction(w, { k: 'plant', x: 20 / 63, y: 32 / 63, r: 6, v: 1 });
    expect(w.vegetation[i]).toBeGreaterThanOrEqual(cleared);
  });

  it('乾燥させると砂漠が広がる', () => {
    const w = buildWorld(64);
    applyAction(w, { k: 'rain', x: 0, y: 0, r: 0, v: 1.2 });
    stepTicks(w, 40);
    const wet = computeStats(w).desert;
    applyAction(w, { k: 'rain', x: 0, y: 0, r: 0, v: 0.1 });
    stepTicks(w, 60);
    expect(computeStats(w).desert).toBeGreaterThan(wet);
  });

  it('高い山ほど寒い', () => {
    const w = buildWorld(64);
    applyAction(w, { k: 'rain', x: 0, y: 0, r: 0, v: 1 });
    let hi = 0;
    let lo = 0;
    for (let i = 0; i < w.height.length; i++) {
      if (w.height[i] > 0.6) hi = Math.max(hi, i);
      if (w.height[i] > 0.15 && w.height[i] < 0.25) lo = Math.max(lo, i);
    }
    expect(w.temperature[hi]).toBeLessThan(w.temperature[lo] + 3);
  });

  it('気温を上げると平均気温が上がる', () => {
    const w = buildWorld(64);
    applyAction(w, { k: 'rain', x: 0, y: 0, r: 0, v: 1 });
    const t0 = computeStats(w).temperature;
    applyAction(w, { k: 'temp', x: 0, y: 0, r: 0, v: 4 });
    expect(computeStats(w).temperature).toBeGreaterThan(t0 + 2);
  });

  it('風上の斜面は雨が多く、風下の斜面は乾く（雨蔭）', () => {
    const size = 96;
    const w = buildWorld(size);
    applyAction(w, { k: 'rain', x: 0, y: 0, r: 0, v: 1 });
    let upSum = 0;
    let upN = 0;
    let downSum = 0;
    let downN = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 1; x < size; x++) {
        const i = y * size + x;
        if (w.hydro.ocean[i]) continue;
        const dh = w.height[i] - w.height[i - 1];
        if (dh > 0.004) (upSum += w.precip[i]), upN++;
        else if (dh < -0.004) (downSum += w.precip[i]), downN++;
      }
    }
    expect(upN).toBeGreaterThan(20);
    expect(downN).toBeGreaterThan(20);
    expect(upSum / upN).toBeGreaterThan(downSum / downN);
  });
});
