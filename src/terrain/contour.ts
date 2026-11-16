import type { ContourStroke, Vec2 } from '../types/world.ts';

/** 線分を、太さ付きでセルに焼き付ける。mask は「標高が決まったセル」の印。 */
export function rasterizeStroke(
  stroke: ContourStroke,
  height: Float32Array,
  mask: Uint8Array,
  size: number
): void {
  const pts = stroke.points;
  const radius = Math.max(0.75, (stroke.width * size) / 2);
  if (pts.length === 1) {
    stamp(pts[0].x * (size - 1), pts[0].y * (size - 1), radius, stroke.elevation, height, mask, size);
    return;
  }
  for (let i = 0; i < pts.length - 1; i++) {
    drawLine(pts[i], pts[i + 1], stroke.elevation, radius, height, mask, size);
  }
}

function drawLine(
  a: Vec2,
  b: Vec2,
  elevation: number,
  radius: number,
  height: Float32Array,
  mask: Uint8Array,
  size: number
): void {
  const ax = a.x * (size - 1);
  const ay = a.y * (size - 1);
  const bx = b.x * (size - 1);
  const by = b.y * (size - 1);
  const len = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(len / 0.5));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    stamp(ax + (bx - ax) * t, ay + (by - ay) * t, radius, elevation, height, mask, size);
  }
}

function stamp(
  cx: number,
  cy: number,
  radius: number,
  elevation: number,
  height: Float32Array,
  mask: Uint8Array,
  size: number
): void {
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(size - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(size - 1, Math.ceil(cy + radius));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r2) continue;
      const i = y * size + x;
      // 交差する線は高い方を採用する
      if (!mask[i] || elevation > height[i]) height[i] = elevation;
      mask[i] = 1;
    }
  }
}

/** 点列を間引く（Douglas–Peucker）。URL を短くするために使う。 */
export function simplifyPoints(points: Vec2[], tolerance: number): Vec2[] {
  if (points.length <= 2) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = pointLineDistance(points[i], points[s], points[e]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx !== -1 && maxD > tolerance) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function pointLineDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
