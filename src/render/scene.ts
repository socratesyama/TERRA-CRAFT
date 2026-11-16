import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { ContourStroke, Snapshot, Vec2 } from '../types/world.ts';
import type { LayerId } from '../terrain/colors.ts';
import { HEIGHT_SCALE, WORLD_SIZE, cellToWorldX, cellToWorldZ, pickHeightfield, sampleSurface } from '../terrain/mesh.ts';
import type { PickResult } from '../terrain/mesh.ts';
import { createCamera, createControls, setControlMode } from './camera.ts';
import { createLights } from './lights.ts';
import { setupColorPipeline } from './postprocess.ts';
import { TerrainMesh } from './terrainMesh.ts';
import { FaunaLayer, TreeLayer } from './vegetationMesh.ts';
import { SettlementLayer } from './settlementMesh.ts';
import { Ocean, RainFx } from './waterMesh.ts';

export type SceneOptions = {
  layer: LayerId;
  showContours: boolean;
  showSettlements: boolean;
  showFauna: boolean;
};

/** 3D 世界。描画と計算は分離されていて、ここはスナップショットを受け取って見せるだけ。 */
export class TerraScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private terrain = new TerrainMesh();
  private ocean = new Ocean();
  private rain = new RainFx();
  private trees = new TreeLayer();
  private fauna = new FaunaLayer();
  private settlements = new SettlementLayer();
  private contourGroup = new THREE.Group();
  private previewLine: THREE.Line;
  private cursor: THREE.Mesh;
  private ray = new THREE.Raycaster();
  private ro: ResizeObserver;
  private raf = 0;
  private last = performance.now();

  private snap: Snapshot | null = null;
  private opts: SceneOptions = { layer: 'world', showContours: true, showSettlements: true, showFauna: true };
  private reveal = 1;
  private revealStart = 0;
  private raining = false;
  private strokes: ContourStroke[] = [];

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    setupColorPipeline(this.renderer);
    this.renderer.setClearColor('#0d1b1e');
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.style.display = 'block';
    host.appendChild(this.renderer.domElement);

    this.camera = createCamera(1);
    this.controls = createControls(this.camera, this.renderer.domElement);
    setControlMode(this.controls, false);

    this.scene.fog = new THREE.Fog('#0d1b1e', 170, 340);
    for (const l of createLights()) this.scene.add(l);
    this.scene.add(
      this.terrain.mesh,
      this.ocean.mesh,
      this.trees.mesh,
      this.fauna.group,
      this.settlements.mesh,
      this.contourGroup,
      this.rain.lines
    );

    this.previewLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: '#e76f51' })
    );
    this.previewLine.frustumCulled = false;
    this.scene.add(this.previewLine);

    this.cursor = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1, 56),
      new THREE.MeshBasicMaterial({ color: '#e9f1ec', transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide })
    );
    this.cursor.rotation.x = -Math.PI / 2;
    this.cursor.visible = false;
    this.cursor.renderOrder = 10;
    this.scene.add(this.cursor);

    this.ocean.setLevel(0.1);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.loop();
  }

  private resize(): void {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setOptions(o: SceneOptions): void {
    const layerChanged = o.layer !== this.opts.layer || o.showSettlements !== this.opts.showSettlements;
    this.opts = o;
    if (this.snap && layerChanged) this.terrain.update(this.snap, o.layer, this.colorOpts());
    this.contourGroup.visible = o.showContours;
    this.settlements.mesh.visible = o.showSettlements && (o.layer === 'world');
    this.trees.mesh.visible = o.layer === 'world' || o.layer === 'vegetation';
  }

  private colorOpts() {
    return { riverReveal: this.reveal, showSettlements: this.opts.showSettlements };
  }

  setSnapshot(snap: Snapshot): void {
    const prevRain = this.snap?.rainfall ?? 0;
    if (prevRain === 0 && snap.rainfall > 0) {
      this.reveal = 0;
      this.revealStart = performance.now();
    }
    this.snap = snap;
    this.ocean.setLevel(snap.seaLevel);
    this.terrain.update(snap, this.opts.layer, this.colorOpts());
    this.trees.update(snap);
    this.fauna.update(snap);
    this.settlements.update(snap);
    this.settlements.mesh.visible = this.opts.showSettlements && this.opts.layer === 'world';
    this.trees.mesh.visible = this.opts.layer === 'world' || this.opts.layer === 'vegetation';
    this.rebuildContours();
  }

  setStrokes(strokes: ContourStroke[]): void {
    this.strokes = strokes;
    this.rebuildContours();
  }

  private rebuildContours(): void {
    for (const c of [...this.contourGroup.children]) {
      this.contourGroup.remove(c);
      const line = c as THREE.Line;
      line.geometry.dispose();
    }
    const mat = new THREE.LineBasicMaterial({ color: '#e9f1ec', transparent: true, opacity: 0.8 });
    for (const s of this.strokes) {
      const pts = s.points.map(
        (p) => new THREE.Vector3((p.x - 0.5) * WORLD_SIZE, s.elevation * HEIGHT_SCALE + 0.5, (p.y - 0.5) * WORLD_SIZE)
      );
      if (pts.length < 2) continue;
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
      line.frustumCulled = false;
      this.contourGroup.add(line);
    }
  }

  /** 描いている途中の線 */
  setPreview(points: Vec2[], elevation: number): void {
    const pts = points.map(
      (p) => new THREE.Vector3((p.x - 0.5) * WORLD_SIZE, elevation * HEIGHT_SCALE + 0.6, (p.y - 0.5) * WORLD_SIZE)
    );
    this.previewLine.geometry.dispose();
    this.previewLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    this.previewLine.visible = pts.length > 1;
  }

  setCursor(hit: PickResult | null, radiusCells: number, color: string): void {
    if (!hit || !this.snap) {
      this.cursor.visible = false;
      return;
    }
    const r = (radiusCells * WORLD_SIZE) / (this.snap.size - 1);
    this.cursor.visible = true;
    this.cursor.position.set(hit.point[0], hit.point[1] + 0.4, hit.point[2]);
    this.cursor.scale.set(r, r, r);
    (this.cursor.material as THREE.MeshBasicMaterial).color.set(color);
  }

  setOrbitMode(orbit: boolean): void {
    setControlMode(this.controls, orbit);
  }

  setCinema(on: boolean): void {
    this.controls.autoRotate = on;
  }

  setRaining(on: boolean): void {
    this.raining = on;
  }

  /** 画面上の位置から、地表の位置を求める */
  pick(clientX: number, clientY: number): PickResult | null {
    if (!this.snap) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this.ray.setFromCamera(ndc, this.camera);
    const o = this.ray.ray.origin;
    const d = this.ray.ray.direction;
    return pickHeightfield([o.x, o.y, o.z], [d.x, d.y, d.z], this.snap.height, this.snap.lake, this.snap.size, this.snap.seaLevel);
  }

  surfaceAt(u: number, v: number): number {
    if (!this.snap) return 0;
    const s = this.snap.size;
    return sampleSurface(this.snap.height, this.snap.lake, s, u * (s - 1), v * (s - 1));
  }

  screenshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;

    if (this.reveal < 1 && this.snap) {
      this.reveal = Math.min(1, (now - this.revealStart) / 2200);
      this.terrain.recolor(this.snap, this.opts.layer, this.colorOpts());
    }
    this.rain.update(dt, this.raining);
    this.fauna.animate(now / 1000, this.opts.showFauna && this.opts.layer === 'world');
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.terrain.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

export { cellToWorldX, cellToWorldZ };
