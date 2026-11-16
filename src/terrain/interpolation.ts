export type SeedPoint = { x: number; y: number; h: number };

/** マスクされたセルから、補間の種を取り出す。多すぎるときは等間隔に間引く。 */
export function collectSeeds(
  height: Float32Array,
  mask: Uint8Array,
  size: number,
  maxSeeds = 1400
): SeedPoint[] {
  const all: SeedPoint[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (mask[i]) all.push({ x, y, h: height[i] });
    }
  }
  if (all.length <= maxSeeds) return all;
  const stride = all.length / maxSeeds;
  const out: SeedPoint[] = [];
  for (let k = 0; k < maxSeeds; k++) out.push(all[Math.floor(k * stride)]);
  return out;
}

/**
 * 逆距離加重補間（IDW）。
 * h = (Σ w_i h_i) / (Σ w_i + w0) × exp(−(d_min / R)^1.5),  w_i = 1 / d_i^2
 * 最も近い線までの距離 d_min が R を超えると、標高は海面へ落ちていく。
 */
export function interpolateHeight(
  height: Float32Array,
  mask: Uint8Array,
  size: number,
  seeds: SeedPoint[],
  falloffRadius = size * 0.13
): void {
  if (seeds.length === 0) {
    height.fill(0);
    return;
  }
  const w0 = 1 / (falloffRadius * falloffRadius);
  const n = seeds.length;
  const sx = new Float32Array(n);
  const sy = new Float32Array(n);
  const sh = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    sx[k] = seeds[k].x;
    sy[k] = seeds[k].y;
    sh[k] = seeds[k].h;
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (mask[i]) continue;
      let wSum = w0;
      let hSum = 0;
      let dMin2 = Infinity;
      for (let k = 0; k < n; k++) {
        const dx = x - sx[k];
        const dy = y - sy[k];
        const d2 = dx * dx + dy * dy;
        if (d2 < dMin2) dMin2 = d2;
        const w = 1 / (d2 + 0.25);
        wSum += w;
        hSum += w * sh[k];
      }
      // 線から離れるほど海面へ落ちる（海岸線の外側へなだらかに沈む）
      const dn = Math.sqrt(dMin2) / falloffRadius;
      height[i] = (hSum / wSum) * Math.exp(-dn * Math.sqrt(dn));
    }
  }
}
