export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const smoothstep = (a: number, b: number, v: number): number => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** 8 近傍のオフセット */
export const DX = [-1, 0, 1, -1, 1, -1, 0, 1] as const;
export const DY = [-1, -1, -1, 0, 0, 1, 1, 1] as const;
export const DIST = [
  Math.SQRT2, 1, Math.SQRT2,
  1, 1,
  Math.SQRT2, 1, Math.SQRT2,
] as const;
