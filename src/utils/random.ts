/** 再現可能な乱数。同じシードなら同じ列を返す。 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 格子点ごとのハッシュ乱数（状態を持たないので並べ替えても結果が変わらない） */
export function hash2(seed: number, x: number, y: number): number {
  let h =
    Math.imul(x | 0, 374761393) +
    Math.imul(y | 0, 668265263) +
    Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
