import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { TerraScene } from '../render/scene.ts';
import { useUi } from '../state/uiStore.ts';
import { useWorld } from '../state/worldStore.ts';
import { simplifyPoints } from '../terrain/contour.ts';
import type { Vec2 } from '../types/world.ts';
import { quantizeStroke } from '../utils/url.ts';
import { PRESETS } from '../terrain/presets.ts';
import { TOOLS } from './tools.ts';

let sceneRef: TerraScene | null = null;
/** 画面の画像を取り出す（StageBar から使う） */
export function captureScene(): string | null {
  return sceneRef ? sceneRef.screenshot() : null;
}

type Drag = { pts: Vec2[]; lastDab: Vec2 | null; id: number };

export function Viewport() {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<TerraScene | null>(null);
  const drag = useRef<Drag | null>(null);

  const snap = useWorld((s) => s.snap);
  const strokes = useWorld((s) => s.strokes);
  const restoring = useWorld((s) => s.restoring);
  const setStrokes = useWorld((s) => s.setStrokes);
  const layer = useUi((s) => s.layer);
  const showContours = useUi((s) => s.showContours);
  const showSettlements = useUi((s) => s.showSettlements);
  const showFauna = useUi((s) => s.showFauna);
  const orbitMode = useUi((s) => s.orbitMode);
  const cinema = useUi((s) => s.cinema);
  const rainUntil = useUi((s) => s.rainUntil);

  useEffect(() => {
    const s = new TerraScene(host.current!);
    scene.current = s;
    sceneRef = s;
    return () => {
      s.dispose();
      scene.current = null;
      sceneRef = null;
    };
  }, []);

  useEffect(() => {
    if (snap) scene.current?.setSnapshot(snap);
  }, [snap]);
  useEffect(() => {
    scene.current?.setStrokes(strokes);
  }, [strokes]);
  useEffect(() => {
    scene.current?.setOptions({ layer, showContours, showSettlements, showFauna });
  }, [layer, showContours, showSettlements, showFauna]);
  useEffect(() => {
    scene.current?.setOrbitMode(orbitMode);
  }, [orbitMode]);
  useEffect(() => {
    scene.current?.setCinema(cinema);
  }, [cinema]);
  useEffect(() => {
    scene.current?.setRaining((snap?.rainfall ?? 0) > 0 && Date.now() < rainUntil);
    if (rainUntil > Date.now()) {
      const t = window.setTimeout(() => scene.current?.setRaining(false), rainUntil - Date.now());
      return () => window.clearTimeout(t);
    }
  }, [rainUntil, snap?.rainfall]);

  const toolColor = () => TOOLS.find((t) => t.id === useUi.getState().tool)!.color;

  const onPointerDown = (e: ReactPointerEvent) => {
    const ui = useUi.getState();
    const sc = scene.current;
    if (!sc) return;
    if (!e.isPrimary) {
      // 2 本目の指は視点操作。描きかけの線は捨てる
      drag.current = null;
      sc.setPreview([], 0);
      return;
    }
    if (e.button !== 0 || ui.orbitMode) return;
    const hit = sc.pick(e.clientX, e.clientY);
    if (!hit) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = { x: hit.u, y: hit.v };
    drag.current = { pts: [p], lastDab: p, id: e.pointerId };
    if (ui.tool === 'contour') {
      sc.setPreview([p], ui.contourElev);
    } else {
      void useWorld.getState().act({ k: ui.tool, x: p.x, y: p.y, r: ui.brushR, v: ui.brushV });
    }
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const ui = useUi.getState();
    const sc = scene.current;
    const st = useWorld.getState().snap;
    if (!sc || !st) return;
    const hit = sc.pick(e.clientX, e.clientY);
    const radius = ui.tool === 'contour' ? Math.max(1.5, (ui.contourWidth * st.size) / 2) : ui.brushR;
    sc.setCursor(ui.orbitMode ? null : hit, radius, toolColor());

    const d = drag.current;
    if (!d || !hit || d.id !== e.pointerId) return;
    const p = { x: hit.u, y: hit.v };
    if (ui.tool === 'contour') {
      const last = d.pts[d.pts.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) >= 0.006) {
        d.pts.push(p);
        sc.setPreview(d.pts, ui.contourElev);
      }
    } else if (ui.tool !== 'dam' && d.lastDab) {
      const cells = Math.hypot(p.x - d.lastDab.x, p.y - d.lastDab.y) * (st.size - 1);
      if (cells >= ui.brushR * 0.5 && useWorld.getState().pending === 0) {
        d.lastDab = p;
        void useWorld.getState().act({ k: ui.tool, x: p.x, y: p.y, r: ui.brushR, v: ui.brushV });
      }
    }
  };

  const finish = (e: ReactPointerEvent) => {
    const d = drag.current;
    const ui = useUi.getState();
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    scene.current?.setPreview([], 0);
    if (ui.tool === 'contour' && d.pts.length >= 2) {
      const pts = simplifyPoints(d.pts, 0.002);
      const stroke = quantizeStroke({
        id: `s${Date.now()}`,
        points: pts,
        elevation: ui.contourElev,
        width: ui.contourWidth,
      });
      void useWorld.getState().addStroke(stroke);
    }
  };

  const empty = snap && strokes.length === 0;

  return (
    <div className="stage-view">
      <div
        ref={host}
        className="canvas-host"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onPointerLeave={() => scene.current?.setCursor(null, 0, '#fff')}
        role="application"
        aria-label="3D の世界。ドラッグして等高線を描く"
      />
      {empty ? (
        <div className="empty">
          <p className="empty-title">指でなぞって、山の輪郭を描こう</p>
          <p className="empty-sub">描いた線が標高になり、その瞬間に地形が立ち上がる。</p>
          <button className="btn primary" onClick={() => void setStrokes(PRESETS[1].strokes)}>
            サンプルの大陸を読み込む
          </button>
        </div>
      ) : null}
      {restoring !== null ? (
        <div className="overlay" role="status">
          世界を復元しています {Math.round(restoring * 100)}%
        </div>
      ) : null}
    </div>
  );
}
