import { hash2 } from '../utils/random.ts';

/** 0〜1 の値ノイズ（格子点のハッシュを滑らかに補間） */
export function valueNoise(seed: number, x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(seed, xi, yi);
  const b = hash2(seed, xi + 1, yi);
  const c = hash2(seed, xi, yi + 1);
  const d = hash2(seed, xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** 複数オクターブの fBm。戻り値は -1〜1。 */
export function fbm(
  seed: number,
  x: number,
  y: number,
  octaves: number,
  lacunarity = 2,
  gain = 0.5
): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * (valueNoise(seed + o * 101, x * freq, y * freq) * 2 - 1);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** 尾根状ノイズ（山の稜線が出やすい）。戻り値は 0〜1。 */
export function ridged(
  seed: number,
  x: number,
  y: number,
  octaves: number
): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const n = 1 - Math.abs(valueNoise(seed + o * 211, x * freq, y * freq) * 2 - 1);
    sum += amp * n * n;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

export function addFractalNoise(
  height: Float32Array,
  size: number,
  scale: number,
  octaves: number,
  seed: number,
  strength: number
): void {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const h = height[i];
      // 高いところほど荒く、平地は穏やかにする
      const amp = strength * (0.25 + 1.4 * h);
      const n = fbm(seed, x / scale, y / scale, octaves) * 0.6 + (ridged(seed + 7, x / scale, y / scale, octaves) - 0.5) * 0.8;
      height[i] = h + n * amp;
    }
  }
}
