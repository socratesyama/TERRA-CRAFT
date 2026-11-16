import type { ContourStroke, ShareState, Snapshot } from '../types/world.ts';
import type { Req, Res } from './protocol.ts';

type Pending = {
  resolve: (r: Res) => void;
  reject: (e: Error) => void;
  onProgress?: (ratio: number) => void;
};

/** シミュレーション Worker への Promise ベースの窓口。UI スレッドで重い計算をしない。 */
class SimClient {
  private worker: Worker;
  private next = 1;
  private pending = new Map<number, Pending>();
  /** 返事待ちのリクエスト数 */
  inflight = 0;
  /** 直近の 1 リクエストにかかった時間 [ms] */
  lastMs = 0;

  constructor() {
    this.worker = new Worker(new URL('./simulation.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<Res>) => {
      const r = e.data;
      const p = this.pending.get(r.id);
      if (!p) return;
      if (r.type === 'progress') {
        p.onProgress?.(r.ratio);
        return;
      }
      this.pending.delete(r.id);
      this.inflight--;
      if (r.type === 'error') p.reject(new Error(r.message));
      else p.resolve(r);
    };
  }

  private send(build: (id: number) => Req, onProgress?: (ratio: number) => void): Promise<Res> {
    const id = this.next++;
    this.inflight++;
    return new Promise<Res>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress });
      this.worker.postMessage(build(id));
    });
  }

  private async snap(build: (id: number) => Req, onProgress?: (r: number) => void): Promise<Snapshot> {
    const r = await this.send(build, onProgress);
    if (r.type !== 'snapshot') throw new Error('unexpected response');
    this.lastMs = r.ms;
    return r.snapshot;
  }

  reset(size: number, seed: number) {
    return this.snap((id) => ({ id, type: 'reset', size, seed }));
  }
  snapshot() {
    return this.snap((id) => ({ id, type: 'snapshot' }));
  }
  setStrokes(strokes: ContourStroke[]) {
    return this.snap((id) => ({ id, type: 'setStrokes', strokes }));
  }
  action(action: Extract<Req, { type: 'action' }>['action']) {
    return this.snap((id) => ({ id, type: 'action', action }));
  }
  step(ticks: number) {
    return this.snap((id) => ({ id, type: 'step', ticks }));
  }
  restore(state: ShareState, onProgress?: (ratio: number) => void) {
    return this.snap((id) => ({ id, type: 'restore', state }), onProgress);
  }
  async exportState(): Promise<ShareState> {
    const r = await this.send((id) => ({ id, type: 'export' }));
    if (r.type !== 'state') throw new Error('unexpected response');
    return r.state;
  }
}

export const sim = new SimClient();
