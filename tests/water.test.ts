import { describe, expect, it } from 'vitest';
import { applyAction, refresh } from '../src/simulation/engine.ts';
import { riverThreshold, computeRiverMask, riverWidth } from '../src/simulation/water.ts';
import { buildWorld, count, withHeight } from './helpers.ts';

describe('水循環', () => {
  it('雨が降らなければ川はできない', () => {
    const w = buildWorld();
    w.rainfall = 0;
    refresh(w);
    const rivers = computeRiverMask(w.water, riverThreshold(w));
    expect(count(rivers, (v) => v === 1)).toBe(0);
  });

  it('雨を降らせると川ができる', () => {
    const w = buildWorld();
    applyAction(w, { k: 'rain', x: 0, y: 0, r: 0, v: 1 });
    const rivers = computeRiverMask(w.water, riverThreshold(w));
    expect(count(rivers, (v) => v === 1)).toBeGreaterThan(5);
  });

  it('水は下流へ向かって増え続ける', () => {
    const w = buildWorld();
    applyAction(w, { k: 'rain', x: 0, y: 0, r: 0, v: 1 });
    const { receiver } = w.hydro;
    let violations = 0;
    for (let i = 0; i < w.water.length; i++) {
      const r = receiver[i];
      if (r >= 0 && w.water[r] < w.water[i] * 0.98) violations++;
    }
    expect(violations).toBe(0);
  });

  it('流れ先は必ず低い（または同じ高さの）方向', () => {
    const w = buildWorld();
    applyAction(w, { k: 'rain', x: 0, y: 0, r: 0, v: 1 });
    const { receiver, filled } = w.hydro;
    for (let i = 0; i < w.water.length; i++) {
      const r = receiver[i];
      if (r >= 0) expect(filled[r]).toBeLessThan(filled[i]);
    }
  });

  it('盆地に湖ができる', () => {
    const size = 48;
    const w = withHeight(size, (x, y) => {
      const d = Math.hypot(x - 24, y - 24);
      // 中央がくぼみ、周囲は縁として高く、外側はなだらかに端へ下る
      if (d < 14) return 0.3 + 0.3 * (d / 14);
      return Math.max(0.2, 0.6 - (d - 14) * 0.012);
    });
    const lakeCells = count(w.lake, (v) => v > 0);
    expect(lakeCells).toBeGreaterThan(10);
    expect(w.lake[24 * size + 24]).toBeGreaterThan(0);
  });

  it('雨が降らなければ盆地にも湖はできない', () => {
    const size = 48;
    const w = withHeight(
      size,
      (x, y) => {
        const d = Math.hypot(x - 24, y - 24);
        return d < 14 ? 0.3 + 0.3 * (d / 14) : Math.max(0.2, 0.6 - (d - 14) * 0.012);
      },
      0
    );
    expect(count(w.lake, (v) => v > 0)).toBe(0);
  });

  it('谷をダムでせき止めると上流に湖ができる', () => {
    const size = 64;
    const valley = (x: number, y: number) => {
      const s = Math.max(0.02, 0.5 * (1 - y / 58));
      return s + 0.025 * Math.abs(x - 32);
    };
    const w = withHeight(size, valley);
    const before = count(w.lake, (v) => v > 0);
    applyAction(w, { k: 'dam', x: 32 / 63, y: 25 / 63, r: 3 });
    const after = count(w.lake, (v) => v > 0);
    expect(after).toBeGreaterThan(before);
    // 湖はダムより上流（y が小さい側）にできる
    let upstream = 0;
    for (let y = 0; y < 25; y++) for (let x = 0; x < size; x++) if (w.lake[y * size + x] > 0) upstream++;
    expect(upstream).toBeGreaterThan(0);
  });

  it('ダムの下流では流量が減る（湖での蒸発・取水）', () => {
    const size = 64;
    const valley = (x: number, y: number) => Math.max(0.02, 0.5 * (1 - y / 58)) + 0.025 * Math.abs(x - 32);
    const w = withHeight(size, valley);
    const probe = 45 * size + 32;
    const before = w.water[probe];
    applyAction(w, { k: 'dam', x: 32 / 63, y: 25 / 63, r: 3 });
    expect(w.water[probe]).toBeLessThan(before);
  });

  it('川幅は流量とともに広がる', () => {
    expect(riverWidth(1000)).toBeGreaterThan(riverWidth(10));
  });

  it('山を削ると水の流れが変わる', () => {
    const w = buildWorld();
    applyAction(w, { k: 'rain', x: 0, y: 0, r: 0, v: 1 });
    const before = Int32Array.from(w.hydro.receiver);
    applyAction(w, { k: 'cut', x: 0.46, y: 0.5, r: 10, v: 1 });
    let changed = 0;
    for (let i = 0; i < before.length; i++) if (before[i] !== w.hydro.receiver[i]) changed++;
    expect(changed).toBeGreaterThan(0);
  });
});
