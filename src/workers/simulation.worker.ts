/// <reference lib="webworker" />
import {
  applyAction,
  createWorld,
  exportState,
  restoreWorld,
  setStrokes,
  snapshot,
  stepTicks,
} from '../simulation/engine.ts';
import type { Snapshot, World } from '../types/world.ts';
import type { Req, Res } from './protocol.ts';

const ctx = self as unknown as DedicatedWorkerGlobalScope;
let world: World = createWorld(192, 1);

function buffers(s: Snapshot): ArrayBuffer[] {
  const out: ArrayBuffer[] = [];
  for (const v of Object.values(s)) {
    if (ArrayBuffer.isView(v)) out.push(v.buffer as ArrayBuffer);
  }
  return out;
}

function reply(id: number, t0: number): void {
  const snap = snapshot(world);
  const msg: Res = { id, type: 'snapshot', snapshot: snap, ms: performance.now() - t0 };
  ctx.postMessage(msg, buffers(snap));
}

ctx.onmessage = (e: MessageEvent<Req>) => {
  const m = e.data;
  const t0 = performance.now();
  try {
    switch (m.type) {
      case 'reset':
        world = createWorld(m.size, m.seed);
        reply(m.id, t0);
        break;
      case 'snapshot':
        reply(m.id, t0);
        break;
      case 'setStrokes':
        setStrokes(world, m.strokes);
        reply(m.id, t0);
        break;
      case 'action':
        applyAction(world, m.action);
        reply(m.id, t0);
        break;
      case 'step':
        stepTicks(world, m.ticks);
        reply(m.id, t0);
        break;
      case 'restore':
        world = restoreWorld(m.state, (ratio) => {
          const p: Res = { id: m.id, type: 'progress', ratio: Math.min(1, ratio) };
          ctx.postMessage(p);
        });
        reply(m.id, t0);
        break;
      case 'export': {
        const r: Res = { id: m.id, type: 'state', state: exportState(world) };
        ctx.postMessage(r);
        break;
      }
    }
  } catch (err) {
    const r: Res = { id: m.id, type: 'error', message: err instanceof Error ? err.message : String(err) };
    ctx.postMessage(r);
  }
};
