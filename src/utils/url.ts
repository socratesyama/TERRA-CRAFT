import type { Action, ActionKind, ContourStroke, ShareState } from '../types/world.ts';
import { simplifyPoints } from '../terrain/contour.ts';
import { compressText, decompressText } from './compression.ts';

export const URL_LIMIT = 8000;

const KINDS: ActionKind[] = ['cut', 'raise', 'clear', 'plant', 'dam', 'reclaim', 'rain', 'temp'];

/** 共有 URL で再現できるよう、保存前に値を量子化しておく（作成時に必ず通す） */
export const q3 = (v: number): number => Math.round(v * 1000) / 1000;
export const q2 = (v: number): number => Math.round(v * 100) / 100;
export const q1 = (v: number): number => Math.round(v * 10) / 10;

export function quantizeStroke(s: ContourStroke): ContourStroke {
  return {
    id: s.id,
    elevation: q2(s.elevation),
    width: q3(s.width),
    points: s.points.map((p) => ({ x: q3(p.x), y: q3(p.y) })),
  };
}

export function quantizeAction(a: Omit<Action, 't'> & { t?: number }): Omit<Action, 't'> & { t?: number } {
  return { ...a, x: q3(a.x), y: q3(a.y), r: q1(a.r), v: a.v === undefined ? undefined : q2(a.v) };
}

type Packed = {
  v: number;
  s: number;
  n: number;
  c: Array<[number, number, number[]]>;
  a: Array<[number, number, number, number, number, number]>;
  r: number;
  b: number;
  t: number;
};

function pack(state: ShareState): Packed {
  return {
    v: state.v,
    s: state.seed,
    n: state.size,
    c: state.strokes.map((s) => [
      Math.round(s.elevation * 100),
      Math.round(s.width * 1000),
      s.points.flatMap((p) => [Math.round(p.x * 1000), Math.round(p.y * 1000)]),
    ]),
    a: state.actions.map((a) => [
      a.t,
      KINDS.indexOf(a.k),
      Math.round(a.x * 1000),
      Math.round(a.y * 1000),
      Math.round(a.r * 10),
      Math.round((a.v ?? 0) * 100),
    ]),
    r: Math.round(state.rainfall * 100),
    b: Math.round(state.temperatureBias * 100),
    t: state.time,
  };
}

function unpack(p: Packed): ShareState {
  return {
    v: p.v,
    seed: p.s,
    size: p.n,
    strokes: p.c.map(([e, w, flat], i) => {
      const points = [];
      for (let k = 0; k + 1 < flat.length; k += 2) points.push({ x: flat[k] / 1000, y: flat[k + 1] / 1000 });
      return { id: `s${i}`, elevation: e / 100, width: w / 1000, points };
    }),
    actions: p.a.map(([t, k, x, y, r, v]) => ({
      t,
      k: KINDS[k],
      x: x / 1000,
      y: y / 1000,
      r: r / 10,
      v: v / 100,
    })),
    rainfall: p.r / 100,
    temperatureBias: p.b / 100,
    time: p.t,
  };
}

export async function encodeShareState(state: ShareState): Promise<string> {
  return compressText(JSON.stringify(pack(state)));
}

export async function decodeShareState(text: string): Promise<ShareState | null> {
  try {
    const json = await decompressText(text);
    const p = JSON.parse(json) as Packed;
    if (!p || typeof p.n !== 'number' || !Array.isArray(p.c)) return null;
    return unpack(p);
  } catch {
    return null;
  }
}

/**
 * URL が長すぎるときは、点を間引いてから、最後に古い干渉を捨てて収める。
 * 戻り値の trimmed が true のとき、復元される世界は元と少し違う可能性がある。
 */
export async function encodeWithinLimit(
  state: ShareState,
  limit = URL_LIMIT
): Promise<{ encoded: string; trimmed: boolean }> {
  let encoded = await encodeShareState(state);
  if (encoded.length <= limit) return { encoded, trimmed: false };

  for (const tol of [0.004, 0.008, 0.016]) {
    const slim: ShareState = {
      ...state,
      strokes: state.strokes.map((s) => ({ ...s, points: simplifyPoints(s.points, tol).map((p) => ({ x: q3(p.x), y: q3(p.y) })) })),
    };
    encoded = await encodeShareState(slim);
    if (encoded.length <= limit) return { encoded, trimmed: true };
  }
  const reduced: ShareState = { ...state, actions: state.actions.slice(0, Math.max(0, state.actions.length >> 1)) };
  encoded = await encodeShareState(reduced);
  return { encoded, trimmed: true };
}

export function readHash(hash: string): string | null {
  const m = /^#?w=([A-Za-z0-9_-]+)$/.exec(hash);
  return m ? m[1] : null;
}

export function buildShareUrl(base: string, encoded: string): string {
  return `${base.split('#')[0]}#w=${encoded}`;
}
