import { create } from 'zustand';
import type { Action, ContourStroke, ShareState, Snapshot, Stats } from '../types/world.ts';
import { sim } from '../workers/client.ts';
import { quantizeAction } from '../utils/url.ts';
import { decodeShareState, readHash } from '../utils/url.ts';
import { useHistory } from './historyStore.ts';
import { useUi } from './uiStore.ts';

type WorldStore = {
  snap: Snapshot | null;
  strokes: ContourStroke[];
  /** 干渉する直前の統計。「何をしたか」との差を数値で見せる。 */
  baseline: Stats | null;
  baselineAt: number;
  pending: number;
  restoring: number | null;
  error: string | null;
  /** 地形以外の干渉（山削り・伐採など）を行った回数 */
  acted: number;
  stepMs: number;

  init: () => Promise<void>;
  setStrokes: (strokes: ContourStroke[], record?: boolean) => Promise<void>;
  addStroke: (stroke: ContourStroke) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  clearAll: () => Promise<void>;
  act: (a: Omit<Action, 't'>) => Promise<void>;
  step: (ticks: number) => Promise<void>;
  toggleRain: () => Promise<void>;
  setRain: (v: number) => Promise<void>;
  setTemp: (v: number) => Promise<void>;
  getShare: () => Promise<ShareState>;
};

async function run<T>(set: (p: Partial<WorldStore>) => void, f: () => Promise<T>): Promise<T | undefined> {
  set({ pending: sim.inflight + 1 });
  try {
    const r = await f();
    return r;
  } catch (e) {
    set({ error: e instanceof Error ? e.message : String(e) });
    return undefined;
  } finally {
    set({ pending: Math.max(0, sim.inflight) });
  }
}

export const useWorld = create<WorldStore>()((set, get) => ({
  snap: null,
  strokes: [],
  baseline: null,
  baselineAt: 0,
  pending: 0,
  restoring: null,
  error: null,
  acted: 0,
  stepMs: 0,

  init: async () => {
    const code = readHash(location.hash);
    if (code) {
      const state = await decodeShareState(code);
      if (state) {
        set({ restoring: 0 });
        const snap = await run(set, () => sim.restore(state, (r) => set({ restoring: r })));
        if (snap) {
          set({ snap, strokes: state.strokes, restoring: null });
          useUi.getState().set({ tutorialOpen: false, tutorialStep: 7 });
          return;
        }
        set({ restoring: null });
      }
    }
    const snap = await run(set, () => sim.reset(192, 1));
    if (snap) set({ snap });
  },

  setStrokes: async (strokes, record = true) => {
    if (record) useHistory.getState().push(get().strokes);
    set({ strokes });
    const snap = await run(set, () => sim.setStrokes(strokes));
    if (snap) set({ snap, baseline: null, stepMs: sim.lastMs });
  },

  addStroke: async (stroke) => {
    await get().setStrokes([...get().strokes, stroke]);
  },

  undo: async () => {
    const prev = useHistory.getState().undo(get().strokes);
    if (prev) await get().setStrokes(prev, false);
  },

  redo: async () => {
    const next = useHistory.getState().redo(get().strokes);
    if (next) await get().setStrokes(next, false);
  },

  clearAll: async () => {
    await get().setStrokes([]);
    useUi.getState().set({ playing: false });
  },

  act: async (a) => {
    const now = Date.now();
    const cur = get().snap;
    if (cur && (get().baseline === null || now - get().baselineAt > 4000) && a.k !== 'rain' && a.k !== 'temp') {
      set({ baseline: cur.stats, baselineAt: now });
    }
    const action = quantizeAction(a);
    const snap = await run(set, () => sim.action(action));
    if (snap) {
      set({ snap, stepMs: sim.lastMs, acted: get().acted + (a.k === 'rain' || a.k === 'temp' ? 0 : 1) });
    }
  },

  step: async (ticks) => {
    const snap = await run(set, () => sim.step(ticks));
    if (snap) set({ snap, stepMs: sim.lastMs / Math.max(1, ticks) });
  },

  setRain: async (v) => {
    await get().act({ k: 'rain', x: 0, y: 0, r: 0, v });
    if (v > 0) useUi.getState().set({ rainUntil: Date.now() + 6000 });
  },

  setTemp: async (v) => {
    await get().act({ k: 'temp', x: 0, y: 0, r: 0, v });
  },

  toggleRain: async () => {
    const on = (get().snap?.rainfall ?? 0) > 0;
    await get().setRain(on ? 0 : 1);
    if (!on) useUi.getState().set({ playing: true });
  },

  getShare: () => sim.exportState(),
}));
