import { describe, expect, it } from 'vitest';
import { applyAction, createWorld, exportState, restoreWorld, setStrokes, stepTicks } from '../src/simulation/engine.ts';
import {
  URL_LIMIT,
  buildShareUrl,
  decodeShareState,
  encodeShareState,
  encodeWithinLimit,
  quantizeAction,
  quantizeStroke,
  readHash,
} from '../src/utils/url.ts';
import { islandStrokes, ring } from './helpers.ts';

describe('URL 共有', () => {
  it('保存と復元が一致する', async () => {
    const w = createWorld(64, 11);
    setStrokes(w, islandStrokes().map(quantizeStroke));
    applyAction(w, quantizeAction({ k: 'rain', x: 0, y: 0, r: 0, v: 1 }));
    stepTicks(w, 6);
    const state = exportState(w);
    const text = await encodeShareState(state);
    const back = await decodeShareState(text);
    expect(back).not.toBeNull();
    expect(back!.seed).toBe(state.seed);
    expect(back!.size).toBe(state.size);
    expect(back!.time).toBe(state.time);
    expect(back!.rainfall).toBeCloseTo(state.rainfall, 5);
    expect(back!.strokes.length).toBe(state.strokes.length);
    expect(back!.strokes[0].points[3].x).toBeCloseTo(state.strokes[0].points[3].x, 5);
    expect(back!.actions[0].k).toBe('rain');
  });

  it('URL を開くと同じ世界が復元される', async () => {
    const w = createWorld(64, 4);
    setStrokes(w, islandStrokes().map(quantizeStroke));
    applyAction(w, quantizeAction({ k: 'rain', x: 0, y: 0, r: 0, v: 1 }));
    stepTicks(w, 8);
    applyAction(w, quantizeAction({ k: 'cut', x: 0.46, y: 0.5, r: 6.34, v: 0.8 }));
    stepTicks(w, 8);
    const back = await decodeShareState(await encodeShareState(exportState(w)));
    const restored = restoreWorld(back!);
    expect(restored.time).toBe(w.time);
    expect(Array.from(restored.height)).toEqual(Array.from(w.height));
    expect(Array.from(restored.vegetation)).toEqual(Array.from(w.vegetation));
    expect(restored.settlements.length).toBe(w.settlements.length);
  });

  it('壊れた入力は null を返す', async () => {
    expect(await decodeShareState('zzzz')).toBeNull();
    expect(await decodeShareState('')).toBeNull();
  });

  it('等高線 12 本でも URL は 8,000 文字以内', async () => {
    const strokes = Array.from({ length: 12 }, (_, i) =>
      quantizeStroke({
        ...ring(0.2 + (i % 4) * 0.2, 0.2 + Math.floor(i / 4) * 0.25, 0.08, 0.3 + (i % 5) * 0.1),
        id: `s${i}`,
      })
    );
    const w = createWorld(192, 1);
    setStrokes(w, strokes);
    const { encoded } = await encodeWithinLimit(exportState(w));
    expect(encoded.length).toBeLessThanOrEqual(URL_LIMIT);
  });

  it('ハッシュの読み書き', () => {
    const url = buildShareUrl('https://example.com/app/#old', 'zABC_-123');
    expect(url).toBe('https://example.com/app/#w=zABC_-123');
    expect(readHash('#w=zABC_-123')).toBe('zABC_-123');
    expect(readHash('#other')).toBeNull();
  });
});
