import { useUi } from '../state/uiStore.ts';
import { useWorld } from '../state/worldStore.ts';

type StepDef = { title: string; body: string; done: () => boolean };

const STEPS: StepDef[] = [
  {
    title: '等高線を描いてみよう',
    body: '中央の世界を指でなぞると、その線が山の輪郭になる。',
    done: () => useWorld.getState().strokes.length >= 1,
  },
  {
    title: '高さを変えて山を作ろう',
    body: '「次に描く線の標高」を変えて、もう 1 本描く。高い線ほど山頂になる。',
    done: () => new Set(useWorld.getState().strokes.map((s) => s.elevation)).size >= 2,
  },
  {
    title: '雨を降らせてみよう',
    body: '左上の「雨を降らせる」を押す。',
    done: () => (useWorld.getState().snap?.rainfall ?? 0) > 0,
  },
  {
    title: '川ができるのを見よう',
    body: '雨は高いところから低いところへ集まり、谷に川ができる。盆地には湖ができる。',
    done: () => (useWorld.getState().snap?.stats.riverKm ?? 0) > 0,
  },
  {
    title: '時間を進めて森を育てよう',
    body: '「時間を進める」で、水と気温に応じて森・草原・砂漠が広がり、動物と人が集まる。',
    done: () => (useWorld.getState().snap?.time ?? 0) >= 40,
  },
  {
    title: '山を削って世界を変えてみよう',
    body: '「山削り」「伐採」「ダム」で干渉する。何が起きたかはログに因果の連鎖で残る。',
    done: () => useWorld.getState().acted >= 1,
  },
  {
    title: 'URL で世界を共有しよう',
    body: '右上の「共有」で、いまの世界を再現できる URL を作る。',
    done: () => useUi.getState().shared,
  },
];

export function Tutorial() {
  const open = useUi((s) => s.tutorialOpen);
  const stepIdx = useUi((s) => s.tutorialStep);
  const set = useUi((s) => s.set);
  // 状態が変わるたびに再評価するため、購読しておく
  useWorld((s) => s.snap);
  useWorld((s) => s.strokes);
  useWorld((s) => s.acted);
  useUi((s) => s.shared);

  if (!open || stepIdx >= STEPS.length) return null;
  const step = STEPS[stepIdx];
  const done = step.done();
  const last = stepIdx === STEPS.length - 1;

  return (
    <div className="tutorial" role="dialog" aria-label="使い方">
      <div className="dots" aria-hidden="true">
        {STEPS.map((_, i) => (
          <span key={i} className={i < stepIdx ? 'dot done' : i === stepIdx ? 'dot now' : 'dot'} />
        ))}
      </div>
      <h2>{step.title}</h2>
      <p>{step.body}</p>
      <div className="row">
        <button
          className={done ? 'btn primary' : 'btn'}
          onClick={() => (last ? set({ tutorialOpen: false, tutorialStep: STEPS.length }) : set({ tutorialStep: stepIdx + 1 }))}
        >
          {done ? (last ? '完了' : 'できた。次へ') : 'とばす'}
        </button>
        <button className="btn" onClick={() => set({ tutorialOpen: false })}>
          閉じる
        </button>
      </div>
    </div>
  );
}
