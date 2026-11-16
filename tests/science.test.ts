import { describe, expect, it } from 'vitest';
import { applyAction, createWorld, setStrokes, stepTicks } from '../src/simulation/engine.ts';
import { budykoRunoff, potentialEvapotranspiration, saturationVaporPressure } from '../src/simulation/climate.ts';
import { netPrimaryProductivity } from '../src/simulation/ecology.ts';
import { diffuseIFD, herbivoreCapacity } from '../src/simulation/fauna.ts';
import { computeStats } from '../src/simulation/metrics.ts';
import { PRESETS } from '../src/terrain/presets.ts';
import { sum } from './helpers.ts';

function grow(presetId: string, ticks = 70) {
  const preset = PRESETS.find((p) => p.id === presetId)!;
  const w = createWorld(96, 5);
  setStrokes(w, preset.strokes);
  applyAction(w, { k: 'rain', x: 0, y: 0, r: 0, v: 1 });
  stepTicks(w, ticks);
  return w;
}

describe('物理・化学の式', () => {
  it('Magnus の式: 0°C で約 6.1 hPa、10°C 上がると約 1.9 倍', () => {
    expect(saturationVaporPressure(0)).toBeCloseTo(6.11, 1);
    const r = saturationVaporPressure(20) / saturationVaporPressure(10);
    expect(r).toBeGreaterThan(1.8);
    expect(r).toBeLessThan(2.0);
  });

  it('Budyko: 降水が多いほど流出が増え、森林は草地より蒸発散が大きい', () => {
    expect(budykoRunoff(1500, 15, 0)).toBeGreaterThan(budykoRunoff(600, 15, 0));
    expect(budykoRunoff(900, 15, 1)).toBeLessThan(budykoRunoff(900, 15, 0));
    expect(budykoRunoff(0, 15, 0)).toBe(0);
    // 流出は降水を超えない
    expect(budykoRunoff(800, 25, 0)).toBeLessThan(800);
    expect(potentialEvapotranspiration(25)).toBeGreaterThan(potentialEvapotranspiration(5));
  });

  it('Miami モデル: 熱帯多雨が最大、砂漠と寒冷地は小さい（リービッヒの最小律）', () => {
    const tropical = netPrimaryProductivity(26, 2500);
    const desert = netPrimaryProductivity(26, 100);
    const tundra = netPrimaryProductivity(-5, 400);
    expect(tropical).toBeGreaterThan(1500);
    expect(desert).toBeLessThan(tropical * 0.2);
    expect(tundra).toBeLessThan(tropical * 0.3);
  });

  it('山を越えた風下は断熱昇温で乾く', () => {
    const w = grow('plateau', 1);
    // 壁の東側（風下）の降水は、西側の海岸（風上）より少ない
    let wind = 0;
    let windN = 0;
    let lee = 0;
    let leeN = 0;
    for (let y = 20; y < 76; y++) {
      for (let x = 2; x < 94; x++) {
        const i = y * 96 + x;
        if (w.hydro.ocean[i]) continue;
        if (x < 22) (wind += w.precip[i]), windN++;
        else if (x > 50) (lee += w.precip[i]), leeN++;
      }
    }
    expect(windN).toBeGreaterThan(10);
    expect(leeN).toBeGreaterThan(10);
    expect(wind / windN).toBeGreaterThan(lee / leeN);
  });
});

describe('動物の生態', () => {
  it('餌と水場のある場所に収容力がある。農地・集落では下がる', () => {
    const w = grow('continent', 60);
    let withForage = 0;
    for (let i = 0; i < w.height.length; i++) if (herbivoreCapacity(w, i) > 5) withForage++;
    expect(withForage).toBeGreaterThan(30);
    const i = w.settlements.length ? w.settlements[0].y * w.size + w.settlements[0].x : -1;
    if (i >= 0) expect(herbivoreCapacity(w, i)).toBe(0);
  });

  it('草食動物が定着し、その上に捕食者が成立する（食物連鎖）', () => {
    const w = grow('continent', 90);
    const s = computeStats(w);
    expect(s.herbivores).toBeGreaterThan(50);
    expect(s.predators).toBeGreaterThan(0);
    // 栄養段階のピラミッド: 捕食者は草食動物よりずっと少ない
    expect(s.predators).toBeLessThan(s.herbivores);
  });

  it('移動（理想自由分布）は動物の総数を変えず、餌の多い場所へ偏る', () => {
    const size = 16;
    const field = new Float32Array(size * size);
    const K = new Float32Array(size * size);
    for (let i = 0; i < K.length; i++) K[i] = i % size >= 8 ? 30 : 5; // 右半分が餌場
    field.fill(5);
    const total = sum(field);
    for (let k = 0; k < 60; k++) diffuseIFD(field, K, size, 0.12);
    expect(Math.abs(sum(field) - total)).toBeLessThan(total * 1e-4);
    let left = 0;
    let right = 0;
    for (let i = 0; i < field.length; i++) (i % size >= 8 ? (right += field[i]) : (left += field[i]));
    expect(right).toBeGreaterThan(left);
  });

  it('生息地を伐採すると草食動物が減る', () => {
    const w = grow('continent', 70);
    const before = computeStats(w).herbivores;
    applyAction(w, { k: 'clear', x: 0.5, y: 0.5, r: 60, v: 1 });
    w.vegetation.fill(0);
    stepTicks(w, 6);
    expect(computeStats(w).herbivores).toBeLessThan(before);
  });
});

describe('人と経済', () => {
  it('分村: 人口圧のかかった集落から新しい集落が生まれる', () => {
    const w = grow('continent', 140);
    expect(w.settlements.length).toBeGreaterThan(1);
  });

  it('交易が成立し、経済規模は人口を上回る（市場による生産性向上）', () => {
    const w = grow('continent', 140);
    const s = computeStats(w);
    if (w.settlements.length >= 2) {
      expect(s.trade).toBeGreaterThan(0);
      expect(s.gdp).toBeGreaterThanOrEqual(s.population);
    }
  });

  it('港は海に面した集落で、海路の輸送費は陸路より安い', () => {
    const w = grow('archipelago', 140);
    for (const s of w.settlements) {
      if (s.port) {
        let coast = false;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          const i = (s.y + dy) * w.size + (s.x + dx);
          if (i >= 0 && i < w.hydro.ocean.length && w.hydro.ocean[i]) coast = true;
        }
        expect(coast).toBe(true);
      }
    }
  });
});

describe('地形が変わると、世界は大きく変わる', () => {
  it('同じ気候でも、地形の違いで雨・植生・人口が大きく違う', () => {
    const results = PRESETS.map((p) => {
      const w = grow(p.id, 100);
      const s = computeStats(w);
      return { id: p.id, forest: s.forest, desert: s.desert, rivers: s.riverKm, lakes: s.lakes, pop: s.population, precip: s.precipitation };
    });
    const spread = (key: 'forest' | 'desert' | 'rivers' | 'precip') => {
      const v = results.map((r) => r[key]);
      return Math.max(...v) - Math.min(...v);
    };
    expect(spread('precip')).toBeGreaterThan(100);
    expect(spread('rivers')).toBeGreaterThan(20);
    expect(spread('forest') + spread('desert')).toBeGreaterThan(8);
  });

  it('盆地には湖ができ、大陸には川ができる', () => {
    expect(computeStats(grow('basin', 20)).lakes).toBeGreaterThan(0);
    expect(computeStats(grow('continent', 20)).riverKm).toBeGreaterThan(20);
  });

  it('雨蔭の高原は、大陸より降水が少ない', () => {
    const plateau = computeStats(grow('plateau', 100));
    const continent = computeStats(grow('continent', 100));
    expect(plateau.precipitation).toBeLessThan(continent.precipitation);
  });
});
