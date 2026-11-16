import { useEffect, useRef, useState } from 'react';
import { useUi } from '../state/uiStore.ts';
import { useWorld } from '../state/worldStore.ts';
import { MAX_ELEVATION } from '../simulation/constants.ts';
import { PRESETS } from '../terrain/presets.ts';
import { Field } from './Field.tsx';
import { TOOLS, fmt } from './tools.ts';

export function Toolbar() {
  const tool = useUi((s) => s.tool);
  const brushR = useUi((s) => s.brushR);
  const brushV = useUi((s) => s.brushV);
  const contourElev = useUi((s) => s.contourElev);
  const contourWidth = useUi((s) => s.contourWidth);
  const set = useUi((s) => s.set);
  const snap = useWorld((s) => s.snap);
  const strokes = useWorld((s) => s.strokes);
  const setStrokes = useWorld((s) => s.setStrokes);
  const toggleRain = useWorld((s) => s.toggleRain);
  const setRain = useWorld((s) => s.setRain);
  const setTemp = useWorld((s) => s.setTemp);
  const clearAll = useWorld((s) => s.clearAll);

  const raining = (snap?.rainfall ?? 0) > 0;
  const [rain, setRainLocal] = useState(1);
  const [temp, setTempLocal] = useState(0);
  const [presetNote, setPresetNote] = useState('');
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (snap && snap.rainfall > 0) setRainLocal(snap.rainfall);
    if (snap) setTempLocal(snap.temperatureBias);
  }, [snap?.rainfall, snap?.temperatureBias]); // eslint-disable-line react-hooks/exhaustive-deps

  const debounce = (f: () => void) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(f, 260);
  };

  const current = TOOLS.find((t) => t.id === tool)!;

  return (
    <aside className="panel tools" aria-label="ツール">
      <header className="brand">
        <h1>TERRA CRAFT</h1>
        <p>等高線を描くと地形が生まれ、雨が降り、川が流れ、森が育ち、人が集まる。</p>
      </header>

      <button className="btn primary wide" onClick={() => void toggleRain()} aria-pressed={raining}>
        {raining ? '雨を止める' : '雨を降らせる'}
      </button>

      <section>
        <h2>地形の例</h2>
        <p className="note">同じ気候で地形だけ変えて、世界がどう変わるかを見比べよう。</p>
        <div className="list" role="group" aria-label="地形の例">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              className="btn"
              onClick={() => {
                setPresetNote(p.note);
                void setStrokes(p.strokes);
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
        {presetNote ? <p className="note">{presetNote}</p> : null}
      </section>

      <section>
        <h2>つくる・変える</h2>
        <div className="list" role="radiogroup" aria-label="ツール">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={tool === t.id}
              className="btn tool"
              onClick={() => set({ tool: t.id, orbitMode: false })}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="note">{current.effect}</p>

        {tool === 'contour' ? (
          <>
            <Field
              label="次に描く線の標高"
              value={`${fmt(contourElev * MAX_ELEVATION)} m`}
              min={0.05}
              max={1}
              step={0.01}
              current={contourElev}
              onChange={(v) => set({ contourElev: v })}
              hint="高い線ほど山頂。低い線は平野や丘になる"
            />
            <Field
              label="線の太さ"
              value={`${fmt(contourWidth * 1000)}`}
              min={0.01}
              max={0.08}
              step={0.005}
              current={contourWidth}
              onChange={(v) => set({ contourWidth: v })}
            />
          </>
        ) : tool === 'dam' ? (
          <p className="note">川の上をタップすると、谷の幅いっぱいに壁を築く。</p>
        ) : (
          <>
            <Field
              label="範囲"
              value={`${fmt(brushR)} セル`}
              min={2}
              max={18}
              step={1}
              current={brushR}
              onChange={(v) => set({ brushR: v })}
            />
            {tool === 'cut' || tool === 'raise' ? (
              <Field
                label="強さ"
                value={`${fmt(brushV * 100)}%`}
                min={0.2}
                max={1}
                step={0.05}
                current={brushV}
                onChange={(v) => set({ brushV: v })}
              />
            ) : null}
          </>
        )}
        <div className="row">
          <button className="btn" disabled={strokes.length === 0} onClick={() => void clearAll()}>
            白紙に戻す
          </button>
        </div>
      </section>

      <section>
        <h2>気候</h2>
        <Field
          label="降水量"
          value={`×${rain.toFixed(1)}`}
          min={0}
          max={2.5}
          step={0.1}
          current={raining ? rain : Math.max(rain, 0)}
          onChange={(v) => {
            setRainLocal(v);
            debounce(() => void setRain(v));
          }}
          hint="1.5 を超える豪雨は洪水を起こす"
        />
        <Field
          label="気温の変化"
          value={`${temp >= 0 ? '+' : '−'}${Math.abs(temp).toFixed(1)} °C`}
          min={-8}
          max={8}
          step={0.5}
          current={temp}
          onChange={(v) => {
            setTempLocal(v);
            debounce(() => void setTemp(v));
          }}
          hint="植生・蒸発散・積雪が変わる"
        />
      </section>
    </aside>
  );
}
