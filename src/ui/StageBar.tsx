import { useHistory } from '../state/historyStore.ts';
import { useUi } from '../state/uiStore.ts';
import { useWorld } from '../state/worldStore.ts';
import { downloadDataUrl, worldFilename } from '../utils/export.ts';
import { captureScene } from './Viewport.tsx';

export function StageBar() {
  const orbitMode = useUi((s) => s.orbitMode);
  const cinema = useUi((s) => s.cinema);
  const set = useUi((s) => s.set);
  const canUndo = useHistory((s) => s.past.length > 0);
  const canRedo = useHistory((s) => s.future.length > 0);
  const undo = useWorld((s) => s.undo);
  const redo = useWorld((s) => s.redo);
  const time = useWorld((s) => s.snap?.time ?? 0);

  return (
    <div className="stagebar" role="toolbar" aria-label="表示と共有">
      <div className="group">
        <button className="btn" disabled={!canUndo} onClick={() => void undo()}>
          取り消し
        </button>
        <button className="btn" disabled={!canRedo} onClick={() => void redo()}>
          やり直し
        </button>
      </div>
      <div className="group">
        <button className="btn" aria-pressed={orbitMode} onClick={() => set({ orbitMode: !orbitMode })}>
          {orbitMode ? '視点を回している' : '描く・変える'}
        </button>
        <button className="btn" aria-pressed={cinema} onClick={() => set({ cinema: !cinema })}>
          カメラ自動
        </button>
      </div>
      <div className="group">
        <button
          className="btn"
          onClick={() => {
            const url = captureScene();
            if (url) downloadDataUrl(url, worldFilename(time));
          }}
        >
          画像を保存
        </button>
        <button className="btn" onClick={() => set({ tutorialOpen: true })}>
          使い方
        </button>
        <button className="btn primary" onClick={() => set({ shareOpen: true })}>
          共有
        </button>
      </div>
    </div>
  );
}
