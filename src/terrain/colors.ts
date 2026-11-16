import { Biome } from '../types/world.ts';
import type { Snapshot } from '../types/world.ts';
import { clamp, smoothstep } from '../utils/math.ts';
import { hash2 } from '../utils/random.ts';

export type LayerId =
  | 'world'
  | 'elevation'
  | 'water'
  | 'depth'
  | 'vegetation'
  | 'temperature'
  | 'precipitation'
  | 'erosion'
  | 'risk';

export const LAYERS: ReadonlyArray<{ id: LayerId; label: string; note: string }> = [
  { id: 'world', label: '総合', note: '地形・水・植生・集落をまとめて表示' },
  { id: 'elevation', label: '標高', note: '海から山頂までの高さ' },
  { id: 'water', label: '水', note: '川の流量と湖・海' },
  { id: 'depth', label: '水深', note: '海・湖の深さと川の水量' },
  { id: 'vegetation', label: '植生', note: '森・草原・砂漠の植生量' },
  { id: 'temperature', label: '気温', note: '標高と緯度で決まる気温' },
  { id: 'precipitation', label: '降水', note: '風上と風下で違う雨の量' },
  { id: 'erosion', label: '侵食', note: '削られた場所と土砂が積もった場所' },
  { id: 'risk', label: 'リスク', note: '洪水と乾燥の危険' },
];

type RGB = readonly [number, number, number];

/** sRGB の 16 進色を、頂点カラー用の線形値に直す */
export function hexToLinear(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)];
}

/** 色設計（計画書 12.2） */
export const PALETTE = {
  deepSea: '#0b2545',
  shallowSea: '#1b4965',
  lake: '#2a6f97',
  river: '#4cc9f0',
  desert: '#e9c46a',
  grass: '#90be6d',
  forest: '#2d6a4f',
  mountain: '#6b705c',
  alpine: '#a8dadc',
  snow: '#ffffff',
  village: '#f4a261',
  city: '#e76f51',
  sand: '#d8c690',
  wetland: '#4f8f7a',
  farm: '#c3d36f',
  road: '#7a5c3e',
  ground: '#2a3d40',
} as const;

const C = Object.fromEntries(
  Object.entries(PALETTE).map(([k, v]) => [k, hexToLinear(v)])
) as Record<keyof typeof PALETTE, RGB>;

function mix(a: RGB, b: RGB, t: number, out: number[]): void {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
}

function ramp(stops: ReadonlyArray<readonly [number, RGB]>, t: number, out: number[]): void {
  if (t <= stops[0][0]) return mix(stops[0][1], stops[0][1], 0, out);
  for (let k = 1; k < stops.length; k++) {
    if (t <= stops[k][0]) {
      const [t0, c0] = stops[k - 1];
      const [t1, c1] = stops[k];
      return mix(c0, c1, (t - t0) / (t1 - t0), out);
    }
  }
  const last = stops[stops.length - 1][1];
  mix(last, last, 0, out);
}

const ELEVATION_RAMP = [
  [0, C.shallowSea],
  [0.1, C.sand],
  [0.16, C.grass],
  [0.34, C.desert],
  [0.55, C.mountain],
  [0.8, C.alpine],
  [1, C.snow],
] as const;

const TEMP_RAMP = [
  [-8, hexToLinear('#2a6f97')],
  [4, C.alpine],
  [16, hexToLinear('#efe6c8')],
  [26, C.desert],
  [34, C.city],
] as const;

const PRECIP_RAMP = [
  [0, hexToLinear('#d8c690')],
  [500, hexToLinear('#b9d6c8')],
  [1200, C.river],
  [2400, C.lake],
] as const;

export type ColorOptions = {
  /** 雨のあと川が現れる演出 0〜1 */
  riverReveal: number;
  showSettlements: boolean;
};

/** 地表の植生による基本色（砂漠 → 草原 → 森林 をなめらかに） */
function vegetationColor(veg: number, farm: boolean, out: number[]): void {
  if (farm) {
    mix(C.farm, C.grass, clamp(veg, 0, 1) * 0.4, out);
    return;
  }
  const g = smoothstep(0.05, 0.26, veg);
  const f = smoothstep(0.38, 0.66, veg);
  const tmp: number[] = [0, 0, 0];
  mix(C.desert, C.grass, g, tmp);
  mix(tmp as unknown as RGB, C.forest, f, out);
}

/** 頂点カラーを out に書き込む（size × size × 3） */
export function colorize(snap: Snapshot, layer: LayerId, out: Float32Array, opts: ColorOptions): void {
  const { size, height } = snap;
  const n = size * size;
  const c: number[] = [0, 0, 0];
  const tmp: number[] = [0, 0, 0];
  const sea = snap.seaLevel;
  const thr = snap.riverThreshold * (1 + (1 - opts.riverReveal) * 14);
  const raining = snap.rainfall > 0;

  for (let i = 0; i < n; i++) {
    const biome = snap.biome[i];
    const h = height[i];
    let shade = 1;

    switch (layer) {
      case 'world': {
        const isRiverCell = raining && biome === Biome.River && snap.water[i] > thr;
        if (biome === Biome.Ocean) {
          const d = clamp((sea - h) / sea, 0, 1);
          mix(C.shallowSea, C.deepSea, Math.pow(d, 0.7), c);
        } else if (biome === Biome.Lake) {
          mix(C.lake, C.shallowSea, clamp(snap.lake[i] * 3, 0, 0.6), c);
        } else if (isRiverCell) {
          const q = clamp(Math.log10(snap.water[i] / snap.riverThreshold + 1) * 1.1, 0, 1);
          mix(C.lake, C.river, 0.45 + 0.55 * q, c);
        } else if (biome === Biome.Snow) {
          c[0] = C.snow[0]; c[1] = C.snow[1]; c[2] = C.snow[2];
          shade = 0.9 + 0.1 * snap.moisture[i];
        } else if (biome === Biome.Alpine) {
          mix(C.alpine, C.snow, smoothstep(0.7, 0.95, h), c);
        } else if (biome === Biome.Mountain) {
          mix(C.mountain, C.grass, clamp(snap.vegetation[i], 0, 1) * 0.5, c);
        } else if (biome === Biome.Coast) {
          mix(C.sand, C.grass, clamp(snap.vegetation[i] * 0.6, 0, 1), c);
        } else if (biome === Biome.Wetland) {
          mix(C.wetland, C.forest, clamp(snap.vegetation[i], 0, 1) * 0.5, c);
        } else {
          vegetationColor(snap.vegetation[i], snap.farm[i] === 1, c);
          if (biome === Biome.River) mix(c as unknown as RGB, C.grass, 0, c);
        }
        if (biome !== Biome.Ocean && biome !== Biome.Lake && !isRiverCell) {
          // 森は個体差、地面は標高による陰影を少しだけ
          const jitter = (hash2(3, i, 11) - 0.5) * 0.08;
          shade = (shade * (0.74 + 0.36 * snap.sunlight[i])) + jitter;
        }
        if (opts.showSettlements) {
          if (snap.settlement[i] > 0) {
            const col = snap.settlement[i] === 3 ? C.city : C.village;
            c[0] = col[0]; c[1] = col[1]; c[2] = col[2];
            shade = 1;
          } else if (snap.road[i] > 0 && biome !== Biome.Ocean && biome !== Biome.Lake) {
            mix(c as unknown as RGB, C.road, 0.85, c);
          }
        }
        break;
      }
      case 'elevation':
        ramp(ELEVATION_RAMP, h, c);
        shade = 0.82 + 0.3 * snap.sunlight[i];
        break;
      case 'water': {
        if (biome === Biome.Ocean) {
          mix(C.shallowSea, C.deepSea, clamp((sea - h) / sea, 0, 1), c);
        } else if (biome === Biome.Lake) {
          c[0] = C.lake[0]; c[1] = C.lake[1]; c[2] = C.lake[2];
        } else {
          const q = raining ? clamp(Math.log10(1 + snap.water[i]) / 3.2, 0, 1) : 0;
          const base = C.ground;
          mix(base, C.river, smoothstep(0.28, 0.75, q), c);
        }
        break;
      }
      case 'depth': {
        let d = 0;
        if (biome === Biome.Ocean) d = 0.4 + 0.6 * clamp((sea - h) / sea, 0, 1);
        else if (biome === Biome.Lake) d = 0.3 + clamp(snap.lake[i] * 4, 0, 0.7);
        else if (raining) d = clamp(Math.log10(1 + snap.water[i]) / 4, 0, 0.55);
        mix(C.ground, C.deepSea, 0, tmp);
        mix(C.ground, C.river, clamp(d * 1.2, 0, 1), c);
        if (d > 0.4 && (biome === Biome.Ocean || biome === Biome.Lake)) mix(C.lake, C.deepSea, clamp(d, 0, 1), c);
        break;
      }
      case 'vegetation': {
        if (biome === Biome.Ocean || biome === Biome.Lake) {
          mix(C.shallowSea, C.deepSea, 0.5, c);
        } else {
          mix(C.ground, C.forest, clamp(snap.vegetation[i] * 1.15, 0, 1), c);
          if (snap.vegetation[i] > 0.55) mix(c as unknown as RGB, C.grass, 0.35, c);
        }
        break;
      }
      case 'temperature':
        if (biome === Biome.Ocean) mix(C.shallowSea, C.deepSea, 0.4, c);
        else ramp(TEMP_RAMP, snap.temperature[i], c);
        break;
      case 'precipitation':
        if (biome === Biome.Ocean) mix(C.shallowSea, C.deepSea, 0.4, c);
        else ramp(PRECIP_RAMP, snap.precip[i], c);
        break;
      case 'erosion': {
        if (biome === Biome.Ocean && Math.abs(snap.sediment[i]) < 1e-5) {
          mix(C.shallowSea, C.deepSea, 0.4, c);
        } else {
          const s = snap.sediment[i];
          const k = clamp(Math.abs(s) * 55, 0, 1);
          if (s < 0) mix(C.ground, C.city, k, c);
          else mix(C.ground, C.river, k, c);
        }
        break;
      }
      case 'risk': {
        if (biome === Biome.Ocean || biome === Biome.Lake) {
          mix(C.shallowSea, C.deepSea, 0.4, c);
        } else {
          const flood = clamp(snap.risk[i] * 1.6, 0, 1);
          const dry = clamp((0.4 - snap.moisture[i]) * 2.2, 0, 1);
          mix(C.ground, C.desert, dry * 0.8, c);
          mix(c as unknown as RGB, C.city, flood, c);
        }
        break;
      }
    }

    const o = i * 3;
    out[o] = clamp(c[0] * shade, 0, 1);
    out[o + 1] = clamp(c[1] * shade, 0, 1);
    out[o + 2] = clamp(c[2] * shade, 0, 1);
  }
}

/** 凡例用: 16 進の表示色 */
export function layerLegend(layer: LayerId): Array<{ label: string; color: string }> {
  switch (layer) {
    case 'world':
      return [
        { label: '海', color: PALETTE.shallowSea },
        { label: '川・湖', color: PALETTE.river },
        { label: '森林', color: PALETTE.forest },
        { label: '草原', color: PALETTE.grass },
        { label: '砂漠', color: PALETTE.desert },
        { label: '山地', color: PALETTE.mountain },
        { label: '集落', color: PALETTE.village },
        { label: '都市', color: PALETTE.city },
      ];
    case 'elevation':
      return [
        { label: '低', color: PALETTE.grass },
        { label: '中', color: PALETTE.desert },
        { label: '高', color: PALETTE.mountain },
        { label: '山頂', color: PALETTE.snow },
      ];
    case 'temperature':
      return [
        { label: '寒', color: PALETTE.lake },
        { label: '温', color: '#efe6c8' },
        { label: '暑', color: PALETTE.city },
      ];
    case 'precipitation':
      return [
        { label: '少', color: PALETTE.sand },
        { label: '中', color: PALETTE.river },
        { label: '多', color: PALETTE.lake },
      ];
    case 'erosion':
      return [
        { label: '侵食', color: PALETTE.city },
        { label: '堆積', color: PALETTE.river },
      ];
    case 'risk':
      return [
        { label: '洪水', color: PALETTE.city },
        { label: '乾燥', color: PALETTE.desert },
      ];
    case 'vegetation':
      return [
        { label: '少', color: PALETTE.ground },
        { label: '多', color: PALETTE.forest },
      ];
    default:
      return [
        { label: '浅い', color: PALETTE.ground },
        { label: '深い', color: PALETTE.river },
      ];
  }
}
