import { describe, expect, it } from 'vitest';
import {
  HEIGHT_SCALE,
  WORLD_SIZE,
  buildTerrainGeometryData,
  pickHeightfield,
  sampleSurface,
  updateTerrainHeights,
} from '../src/terrain/mesh.ts';
import { applyAction, snapshot } from '../src/simulation/engine.ts';
import { colorize, hexToLinear } from '../src/terrain/colors.ts';
import { buildWorld } from './helpers.ts';

describe('メッシュ', () => {
  it('頂点数と三角形数が格子に一致する', () => {
    const { positions, indices } = buildTerrainGeometryData(10);
    expect(positions.length).toBe(10 * 10 * 3);
    expect(indices.length).toBe(9 * 9 * 6);
    expect(Math.max(...indices)).toBe(99);
  });

  it('標高が頂点の高さに反映される', () => {
    const size = 8;
    const { positions } = buildTerrainGeometryData(size);
    const h = new Float32Array(size * size).fill(0.5);
    updateTerrainHeights(positions, h, new Float32Array(size * size), size);
    expect(positions[1]).toBeCloseTo(0.5 * HEIGHT_SCALE, 4);
  });

  it('真上から見下ろした視線は、その場所の地表に当たる', () => {
    const size = 32;
    const h = new Float32Array(size * size).fill(0.4);
    const lake = new Float32Array(size * size);
    const hit = pickHeightfield([10, 80, -5], [0, -1, 0], h, lake, size, 0.1);
    expect(hit).not.toBeNull();
    expect(hit!.point[1]).toBeCloseTo(0.4 * HEIGHT_SCALE, 0);
    expect(hit!.u).toBeCloseTo((10 + WORLD_SIZE / 2) / WORLD_SIZE, 2);
    expect(hit!.v).toBeCloseTo((-5 + WORLD_SIZE / 2) / WORLD_SIZE, 2);
    expect(sampleSurface(h, lake, size, 5, 5)).toBeCloseTo(0.4 * HEIGHT_SCALE, 4);
  });
});

describe('色', () => {
  it('sRGB から線形への変換', () => {
    const [r, g, b] = hexToLinear('#ffffff');
    expect(r).toBeCloseTo(1, 5);
    expect(g).toBeCloseTo(1, 5);
    expect(b).toBeCloseTo(1, 5);
    expect(hexToLinear('#000000')[0]).toBe(0);
  });

  it('すべてのレイヤーが 0〜1 の色を出す', () => {
    const w = buildWorld(48);
    applyAction(w, { k: 'rain', x: 0, y: 0, r: 0, v: 1 });
    const snap = snapshot(w);
    const out = new Float32Array(48 * 48 * 3);
    for (const layer of ['world', 'elevation', 'water', 'depth', 'vegetation', 'temperature', 'precipitation', 'erosion', 'risk'] as const) {
      colorize(snap, layer, out, { riverReveal: 1, showSettlements: true });
      for (let i = 0; i < out.length; i++) {
        expect(Number.isFinite(out[i])).toBe(true);
        expect(out[i]).toBeGreaterThanOrEqual(0);
        expect(out[i]).toBeLessThanOrEqual(1);
      }
    }
  });
});
