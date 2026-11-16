import { create } from 'zustand';
import type { ContourStroke } from '../types/world.ts';

type History = {
  past: ContourStroke[][];
  future: ContourStroke[][];
  push: (strokes: ContourStroke[]) => void;
  undo: (current: ContourStroke[]) => ContourStroke[] | null;
  redo: (current: ContourStroke[]) => ContourStroke[] | null;
  clear: () => void;
};

/** 等高線の取り消し・やり直し */
export const useHistory = create<History>()((set, get) => ({
  past: [],
  future: [],
  push: (strokes) => set((s) => ({ past: [...s.past.slice(-39), strokes], future: [] })),
  undo: (current) => {
    const { past } = get();
    if (past.length === 0) return null;
    const prev = past[past.length - 1];
    set((s) => ({ past: s.past.slice(0, -1), future: [current, ...s.future] }));
    return prev;
  },
  redo: (current) => {
    const { future } = get();
    if (future.length === 0) return null;
    const next = future[0];
    set((s) => ({ past: [...s.past, current], future: s.future.slice(1) }));
    return next;
  },
  clear: () => set({ past: [], future: [] }),
}));
