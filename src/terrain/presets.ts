import type { ContourStroke, Vec2 } from '../types/world.ts';
import { q2, q3 } from '../utils/url.ts';

export type Preset = {
  id: string;
  name: string;
  note: string;
  strokes: ContourStroke[];
};

function line(id: string, pts: Array<[number, number]>, elevation: number, width = 0.035): ContourStroke {
  return {
    id,
    elevation: q2(elevation),
    width: q3(width),
    points: pts.map(([x, y]) => ({ x: q3(x), y: q3(y) })),
  };
}

function ring(id: string, cx: number, cy: number, rx: number, ry: number, elevation: number, width = 0.03): ContourStroke {
  const points: Vec2[] = [];
  for (let k = 0; k <= 28; k++) {
    const a = (k / 28) * Math.PI * 2;
    points.push({ x: q3(cx + Math.cos(a) * rx), y: q3(cy + Math.sin(a) * ry) });
  }
  return { id, points, elevation: q2(elevation), width: q3(width) };
}

/**
 * 地形だけを変えたサンプル。気候・植生・水・人の営みがどう変わるかを見比べられる。
 * 西風が吹くため、山脈の向きと高さで雨の降る場所が変わる。
 */
export const PRESETS: Preset[] = [
  {
    id: 'volcano',
    name: '火山島',
    note: '中央に高峰がある島。山の風上で雨が多く、風下は乾く。',
    strokes: [
      ring('v1', 0.5, 0.5, 0.27, 0.26, 0.28),
      ring('v2', 0.48, 0.5, 0.16, 0.15, 0.55),
      ring('v3', 0.46, 0.5, 0.06, 0.06, 0.85),
    ],
  },
  {
    id: 'continent',
    name: '大河のある大陸',
    note: '西に山脈、東に平野と海。雨が山で集まり、川が平野を潤す。',
    strokes: [
      line('c1', [[0.14, 0.1], [0.16, 0.35], [0.14, 0.62], [0.17, 0.9]], 0.82, 0.045),
      line('c2', [[0.3, 0.12], [0.32, 0.4], [0.3, 0.66], [0.33, 0.88]], 0.42, 0.04),
      line('c3', [[0.5, 0.14], [0.52, 0.45], [0.5, 0.7], [0.53, 0.86]], 0.2, 0.04),
      line('c4', [[0.68, 0.2], [0.7, 0.5], [0.68, 0.78]], 0.13, 0.03),
    ],
  },
  {
    id: 'plateau',
    name: '雨蔭の高原',
    note: '西の高い壁が雨を奪い、東は広い乾燥地になる。',
    strokes: [
      line('p1', [[0.12, 0.08], [0.14, 0.4], [0.12, 0.7], [0.14, 0.92]], 0.95, 0.07),
      line('p2', [[0.3, 0.12], [0.32, 0.5], [0.3, 0.88]], 0.7, 0.06),
      line('p3', [[0.5, 0.15], [0.52, 0.5], [0.5, 0.85]], 0.5, 0.06),
      line('p4', [[0.7, 0.2], [0.72, 0.5], [0.7, 0.8]], 0.45, 0.05),
    ],
  },
  {
    id: 'archipelago',
    name: '列島',
    note: '小さな島が散らばる。海岸線が長く、漁業と海上交易が育つ。',
    strokes: [
      ring('a1', 0.25, 0.3, 0.09, 0.07, 0.4),
      ring('a2', 0.5, 0.25, 0.08, 0.1, 0.5),
      ring('a3', 0.72, 0.38, 0.1, 0.08, 0.42),
      ring('a4', 0.38, 0.62, 0.1, 0.09, 0.48),
      ring('a5', 0.68, 0.7, 0.08, 0.08, 0.36),
    ],
  },
  {
    id: 'basin',
    name: '盆地',
    note: '山に囲まれた低地。水が集まって湖ができ、周りは山で閉ざされる。',
    strokes: [
      ring('b1', 0.5, 0.5, 0.32, 0.3, 0.72, 0.05),
      ring('b2', 0.5, 0.5, 0.2, 0.19, 0.42, 0.04),
      ring('b3', 0.5, 0.5, 0.07, 0.07, 0.24, 0.04),
    ],
  },
];
