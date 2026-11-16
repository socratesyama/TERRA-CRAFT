import type { Action, ContourStroke, ShareState, Snapshot } from '../types/world.ts';

export type Req =
  | { id: number; type: 'reset'; size: number; seed: number }
  | { id: number; type: 'snapshot' }
  | { id: number; type: 'setStrokes'; strokes: ContourStroke[] }
  | { id: number; type: 'action'; action: Omit<Action, 't'> }
  | { id: number; type: 'step'; ticks: number }
  | { id: number; type: 'restore'; state: ShareState }
  | { id: number; type: 'export' };

export type Res =
  | { id: number; type: 'snapshot'; snapshot: Snapshot; ms: number }
  | { id: number; type: 'state'; state: ShareState }
  | { id: number; type: 'progress'; ratio: number }
  | { id: number; type: 'error'; message: string };
