import { describe, expect, it } from 'vitest';
import { generateHeightfield } from '../src/terrain/heightfield.ts';
import { fbm } from '../src/terrain/noise.ts';
import { simplifyPoints } from '../src/terrain/contour.ts';
import { islandStrokes, ring } from './helpers.ts';

describe('高さマップ', () => {
  it('描いた等高線の標高が地形に反映される', () => {
    const size = 96;
    const strokes = [ring(0.5, 0.5, 0.2, 0.7)];
    const h = generateHeightfield(strokes, { size, seed: 3 });
    // 線上の点の高さは 0.7 に近く、地図の隅はほぼ海面
    const px = Math.round(0.7 * (size - 1));
    const py = Math.round(0.5 * (size - 1));
    expect(h[py * size + px]).toBeGreaterThan(0.5);
    expect(h[0]).toBeLessThan(0.1);
  });

  it('線から遠いほど低くなる（海に落ちる）', () => {
    const size = 96;
    const h = generateHeightfield([ring(0.5, 0.5, 0.1, 0.8)], { size, seed: 1 });
    const center = h[48 * size + 48];
    const far = h[5 * size + 5];
    expect(center).toBeGreaterThan(far);
  });

  it('同じシードなら同じ地形、違うシードなら違う地形', () => {
    const a = generateHeightfield(islandStrokes(), { size: 64, seed: 5 });
    const b = generateHeightfield(islandStrokes(), { size: 64, seed: 5 });
    const c = generateHeightfield(islandStrokes(), { size: 64, seed: 6 });
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Array.from(a)).not.toEqual(Array.from(c));
  });

  it('等高線がなければ平らな海', () => {
    const h = generateHeightfield([], { size: 32, seed: 1 });
    expect(Math.max(...h)).toBe(0);
  });

  it('値は 0〜1 に収まり、極端なギザギザがない', () => {
    const size = 96;
    const h = generateHeightfield(islandStrokes(), { size, seed: 9 });
    let maxStep = 0;
    let stepSum = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size - 1; x++) {
        const v = h[y * size + x];
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
        const step = Math.abs(v - h[y * size + x + 1]);
        maxStep = Math.max(maxStep, step);
        stepSum += step;
      }
    }
    expect(maxStep).toBeLessThan(0.15);
    expect(stepSum / (size * (size - 1))).toBeLessThan(0.02);
  });

  it('生成は体感 1 秒以内（192×192）', () => {
    const t0 = performance.now();
    generateHeightfield(islandStrokes(), { size: 192, seed: 1 });
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});

describe('ノイズと間引き', () => {
  it('fBm は同じ入力に同じ値を返す', () => {
    expect(fbm(1, 3.3, 4.4, 5)).toBe(fbm(1, 3.3, 4.4, 5));
    expect(Math.abs(fbm(1, 3.3, 4.4, 5))).toBeLessThanOrEqual(1);
  });

  it('点の間引きは端点を残す', () => {
    const pts = Array.from({ length: 50 }, (_, i) => ({ x: i / 49, y: 0.5 + 0.0001 * Math.sin(i) }));
    const out = simplifyPoints(pts, 0.01);
    expect(out.length).toBeLessThan(pts.length);
    expect(out[0]).toEqual(pts[0]);
    expect(out[out.length - 1]).toEqual(pts[pts.length - 1]);
  });
});
