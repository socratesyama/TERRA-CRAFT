import { useEffect } from 'react';
import { useUi } from './state/uiStore.ts';
import type { MobileTab } from './state/uiStore.ts';
import { useWorld } from './state/worldStore.ts';
import { EventLog } from './ui/EventLog.tsx';
import { LayerPanel } from './ui/LayerPanel.tsx';
import { ShareModal } from './ui/ShareModal.tsx';
import { StageBar } from './ui/StageBar.tsx';
import { StatsPanel } from './ui/StatsPanel.tsx';
import { TimePanel } from './ui/TimePanel.tsx';
import { Toolbar } from './ui/Toolbar.tsx';
import { Tutorial } from './ui/Tutorial.tsx';
import { Viewport } from './ui/Viewport.tsx';

const TABS: ReadonlyArray<{ id: MobileTab; label: string }> = [
  { id: 'tools', label: 'つくる' },
  { id: 'world', label: '世界' },
  { id: 'log', label: '記録' },
];

export function App() {
  const init = useWorld((s) => s.init);
  const error = useWorld((s) => s.error);
  const mobileTab = useUi((s) => s.mobileTab);
  const set = useUi((s) => s.set);

  useEffect(() => {
    void init();
  }, [init]);

  // 時間の進行。Worker が前の計算を終えてから次を頼むので、重い世界でも UI は固まらない。
  const playing = useUi((s) => s.playing);
  const speed = useUi((s) => s.speed);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      if (useWorld.getState().pending === 0) void useWorld.getState().step(speed);
    }, 120);
    return () => window.clearInterval(id);
  }, [playing, speed]);

  return (
    <div className="app" data-tab={mobileTab}>
      <Toolbar />
      <main className="stage" aria-label="世界">
        <Viewport />
        <StageBar />
        <Tutorial />
        {error ? (
          <div className="overlay error" role="alert">
            計算でエラーが起きた: {error}
          </div>
        ) : null}
      </main>
      <aside className="panel info" aria-label="情報">
        <div className="info-world">
          <LayerPanel />
          <StatsPanel />
        </div>
        <div className="info-log">
          <EventLog />
        </div>
      </aside>
      <TimePanel />
      <nav className="tabs" aria-label="パネル切り替え">
        {TABS.map((t) => (
          <button
            key={t.id}
            className="btn"
            aria-pressed={mobileTab === t.id}
            onClick={() => set({ mobileTab: t.id })}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <ShareModal />
    </div>
  );
}
