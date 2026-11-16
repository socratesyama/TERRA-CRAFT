import type { Tool } from '../state/uiStore.ts';

export const TOOLS: ReadonlyArray<{ id: Tool; label: string; effect: string; color: string }> = [
  { id: 'contour', label: '等高線', effect: '地形を作る。標高・勾配・水系が変わる', color: '#e76f51' },
  { id: 'cut', label: '山削り', effect: '地形を低くする。川の流路・侵食・集落の適地が変わる', color: '#e9c46a' },
  { id: 'raise', label: '盛り土', effect: '地形を高くする。分水界が動き、湖や交通路が変わる', color: '#a8dadc' },
  { id: 'clear', label: '伐採', effect: '植生を減らす。流出と侵食が増え、動物の生息地が減る', color: '#e76f51' },
  { id: 'plant', label: '植林', effect: '植生を増やす。蒸発散と保水が増え、侵食が弱まる', color: '#90be6d' },
  { id: 'dam', label: 'ダム', effect: '川をせき止める。上流に湖ができ、下流の流量が減る', color: '#4cc9f0' },
  { id: 'reclaim', label: '埋め立て', effect: '水域を陸地にする。水系・生態・都市の適地が変わる', color: '#d8c690' },
];

export const nf = new Intl.NumberFormat('ja-JP');
export const fmt = (v: number, d = 0): string => nf.format(Number(v.toFixed(d)));
