import { useUi } from '../state/uiStore.ts';
import { useWorld } from '../state/worldStore.ts';
import { fmt } from './tools.ts';

/** 再生・停止・速度・タイムライン。イベントは時間軸の上に印として並ぶ。 */
export function TimePanel() {
  const playing = useUi((s) => s.playing);
  const speed = useUi((s) => s.speed);
  const set = useUi((s) => s.set);
  const snap = useWorld((s) => s.snap);
  const step = useWorld((s) => s.step);
  const stepMs = useWorld((s) => s.stepMs);
  const clearAll = useWorld((s) => s.clearAll);
  const setStrokes = useWorld((s) => s.setStrokes);
  const strokes = useWorld((s) => s.strokes);

  const time = snap?.time ?? 0;
  const span = Math.max(200, Math.ceil((time + 40) / 100) * 100);
  const events = snap?.events ?? [];

  return (
    <footer className="timebar" aria-label="時間">
      <div className="time-controls">
        <button className="btn primary" onClick={() => set({ playing: !playing })} aria-pressed={playing}>
          {playing ? '止める' : '時間を進める'}
        </button>
        <button className="btn" onClick={() => void step(1)} disabled={playing}>
          1 ステップ
        </button>
        <div className="seg" role="radiogroup" aria-label="速度">
          {([1, 2, 4] as const).map((s) => (
            <button key={s} role="radio" aria-checked={speed === s} className="btn" onClick={() => set({ speed: s })}>
              ×{s}
            </button>
          ))}
        </div>
        <button
          className="btn"
          onClick={() => {
            set({ playing: false });
            void setStrokes(strokes, false);
          }}
          disabled={strokes.length === 0}
        >
          時間を戻す
        </button>
        <button className="btn" onClick={() => void clearAll()} disabled={strokes.length === 0}>
          リセット
        </button>
      </div>

      <div className="timeline" role="img" aria-label={`現在 ${time} 年`}>
        <div className="track">
          <div className="fill" style={{ width: `${Math.min(100, (time / span) * 100)}%` }} />
          {events.map((e, i) => (
            <span
              key={`${e.year}-${i}`}
              className={e.kind === 'chain' ? 'mark chain' : 'mark'}
              style={{ left: `${Math.min(100, (e.year / span) * 100)}%` }}
              title={`年 ${e.year}: ${e.message}`}
            />
          ))}
        </div>
      </div>

      <div className="clock">
        <span className="year-now">{fmt(time)}</span>
        <span className="note">年{snap && stepMs > 0 ? ` ・ 1 ステップ ${Math.round(stepMs)}ms` : ''}</span>
      </div>
    </footer>
  );
}
