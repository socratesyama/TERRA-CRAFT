/** 3D 表示の座標系。地図の幅を WORLD_SIZE、標高 1.0 を HEIGHT_SCALE に対応させる。 */
export const WORLD_SIZE = 100;
export const HEIGHT_SCALE = 26;

export function cellToWorldX(cx: number, size: number): number {
  return (cx / (size - 1) - 0.5) * WORLD_SIZE;
}
export function cellToWorldZ(cy: number, size: number): number {
  return (cy / (size - 1) - 0.5) * WORLD_SIZE;
}

export type TerrainGeometryData = {
  positions: Float32Array;
  indices: Uint32Array;
};

/** size × size の頂点格子と三角形インデックスを作る（y は後から更新する） */
export function buildTerrainGeometryData(size: number): TerrainGeometryData {
  const positions = new Float32Array(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 3;
      positions[o] = cellToWorldX(x, size);
      positions[o + 1] = 0;
      positions[o + 2] = cellToWorldZ(y, size);
    }
  }
  const indices = new Uint32Array((size - 1) * (size - 1) * 6);
  let k = 0;
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const a = y * size + x;
      const b = a + 1;
      const c = a + size;
      const d = c + 1;
      indices[k++] = a;
      indices[k++] = c;
      indices[k++] = b;
      indices[k++] = b;
      indices[k++] = c;
      indices[k++] = d;
    }
  }
  return { positions, indices };
}

/** 標高・湖の水面から頂点の高さを更新する */
export function updateTerrainHeights(
  positions: Float32Array,
  height: Float32Array,
  lake: Float32Array,
  size: number
): void {
  for (let i = 0; i < size * size; i++) {
    positions[i * 3 + 1] = (height[i] + lake[i]) * HEIGHT_SCALE;
  }
}

/** 地表の高さ（双一次補間）。ピックと樹木の配置に使う。 */
export function sampleSurface(
  height: Float32Array,
  lake: Float32Array,
  size: number,
  cx: number,
  cy: number
): number {
  const x = Math.min(size - 1.001, Math.max(0, cx));
  const y = Math.min(size - 1.001, Math.max(0, cy));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const i = y0 * size + x0;
  const h00 = height[i] + lake[i];
  const h10 = height[i + 1] + lake[i + 1];
  const h01 = height[i + size] + lake[i + size];
  const h11 = height[i + size + 1] + lake[i + size + 1];
  return (
    (h00 * (1 - fx) + h10 * fx) * (1 - fy) + (h01 * (1 - fx) + h11 * fx) * fy
  ) * HEIGHT_SCALE;
}

export type PickResult = { u: number; v: number; point: [number, number, number] };

/**
 * 視線を一定間隔で進めて高さマップとの交点を探す。三角形ごとの判定より軽く、
 * ポインタを動かすたびに呼べる。見つからなければ海面との交点を返す。
 */
export function pickHeightfield(
  origin: [number, number, number],
  dir: [number, number, number],
  height: Float32Array,
  lake: Float32Array,
  size: number,
  seaLevel: number
): PickResult | null {
  const half = WORLD_SIZE / 2;
  const toCell = (wx: number) => ((wx + half) / WORLD_SIZE) * (size - 1);
  const seaY = seaLevel * HEIGHT_SCALE;
  const step = 0.6;
  let prevT = 0;
  const maxT = 600;
  for (let t = 0; t < maxT; t += step) {
    const x = origin[0] + dir[0] * t;
    const y = origin[1] + dir[1] * t;
    const z = origin[2] + dir[2] * t;
    if (x < -half || x > half || z < -half || z > half) {
      prevT = t;
      continue;
    }
    const ground = Math.max(seaY, sampleSurface(height, lake, size, toCell(x), toCell(z)));
    if (y <= ground) {
      // 直前の点との間を二分して精度を上げる
      let lo = prevT;
      let hi = t;
      for (let k = 0; k < 6; k++) {
        const mid = (lo + hi) / 2;
        const mx = origin[0] + dir[0] * mid;
        const my = origin[1] + dir[1] * mid;
        const mz = origin[2] + dir[2] * mid;
        const g = Math.max(seaY, sampleSurface(height, lake, size, toCell(mx), toCell(mz)));
        if (my <= g) hi = mid;
        else lo = mid;
      }
      const px = origin[0] + dir[0] * hi;
      const py = origin[1] + dir[1] * hi;
      const pz = origin[2] + dir[2] * hi;
      return { u: (px + half) / WORLD_SIZE, v: (pz + half) / WORLD_SIZE, point: [px, py, pz] };
    }
    prevT = t;
  }
  return null;
}
