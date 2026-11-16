import { create } from 'zustand';
import type { LayerId } from '../terrain/colors.ts';

export type Tool = 'contour' | 'cut' | 'raise' | 'clear' | 'plant' | 'dam' | 'reclaim';
export type MobileTab = 'tools' | 'world' | 'log';

export type UiState = {
  tool: Tool;
  layer: LayerId;
  showContours: boolean;
  showSettlements: boolean;
  showFauna: boolean;
  /** 次に描く等高線の標高（0〜1） */
  contourElev: number;
  contourWidth: number;
  brushR: number;
  brushV: number;
  /** true のとき、ドラッグで視点を回す（描画ツールは止める） */
  orbitMode: boolean;
  cinema: boolean;
  playing: boolean;
  speed: 1 | 2 | 4;
  rainUntil: number;
  tutorialStep: number;
  tutorialOpen: boolean;
  shareOpen: boolean;
  shared: boolean;
  mobileTab: MobileTab;
  set: (p: Partial<UiState>) => void;
};

export const useUi = create<UiState>()((set) => ({
  tool: 'contour',
  layer: 'world',
  showContours: true,
  showSettlements: true,
  showFauna: true,
  contourElev: 0.55,
  contourWidth: 0.03,
  brushR: 7,
  brushV: 0.7,
  orbitMode: false,
  cinema: false,
  playing: false,
  speed: 1,
  rainUntil: 0,
  tutorialStep: 0,
  tutorialOpen: true,
  shareOpen: false,
  shared: false,
  mobileTab: 'tools',
  set: (p) => set(p),
}));
