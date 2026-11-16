import * as THREE from 'three';
import { Biome } from '../types/world.ts';
import type { Snapshot } from '../types/world.ts';
import { HEIGHT_SCALE, WORLD_SIZE, cellToWorldX, cellToWorldZ, sampleSurface } from '../terrain/mesh.ts';
import { hash2 } from '../utils/random.ts';

const MAX_TREES = 7000;

/** 森林の樹木。植生量に比例して増え、同じ世界なら同じ位置に生える。 */
export class TreeLayer {
  readonly mesh: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private col = new THREE.Color();

  constructor() {
    const geo = new THREE.ConeGeometry(0.55, 1.8, 5);
    geo.translate(0, 0.9, 0);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), MAX_TREES);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
  }

  update(snap: Snapshot): void {
    const { size } = snap;
    let n = 0;
    const cell = WORLD_SIZE / (size - 1);
    for (let y = 1; y < size - 1 && n < MAX_TREES; y++) {
      for (let x = 1; x < size - 1 && n < MAX_TREES; x++) {
        const i = y * size + x;
        const b = snap.biome[i];
        if (b !== Biome.Forest && b !== Biome.Grassland && b !== Biome.Wetland) continue;
        const v = snap.vegetation[i];
        if (v < 0.4 || snap.farm[i] || snap.settlement[i] || snap.road[i] > 0) continue;
        if (hash2(11, i, 3) > (v - 0.3) * 1.15) continue;
        const jx = (hash2(12, i, 5) - 0.5) * cell;
        const jz = (hash2(13, i, 7) - 0.5) * cell;
        const wx = cellToWorldX(x, size) + jx;
        const wz = cellToWorldZ(y, size) + jz;
        const wy = sampleSurface(snap.height, snap.lake, size, x + jx / cell, y + jz / cell);
        const s = 0.55 + 0.9 * v * (0.7 + 0.6 * hash2(14, i, 9));
        this.m.compose(new THREE.Vector3(wx, wy, wz), this.q, new THREE.Vector3(s, s, s));
        this.mesh.setMatrixAt(n, this.m);
        const g = 0.32 + 0.22 * hash2(15, i, 2);
        this.col.setRGB(0.04, 0.12 + g * 0.18, 0.07);
        this.mesh.setColorAt(n, this.col);
        n++;
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

type Herd = { x: number; y: number; phase: number; radius: number };

/** 動物の群れ。密度の高い場所に群れが現れ、水場と餌場のあたりをゆっくり歩き回る。 */
export class FaunaLayer {
  readonly group = new THREE.Group();
  private herb: THREE.InstancedMesh;
  private pred: THREE.InstancedMesh;
  private herds: Herd[] = [];
  private hunters: Herd[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private snap: Snapshot | null = null;

  constructor() {
    const geo = new THREE.BoxGeometry(0.55, 0.42, 0.95);
    geo.translate(0, 0.25, 0);
    this.herb = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: '#efe6c8', roughness: 0.8 }), 700);
    this.pred = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: '#9c4a2f', roughness: 0.8 }), 120);
    this.herb.count = 0;
    this.pred.count = 0;
    this.herb.frustumCulled = false;
    this.pred.frustumCulled = false;
    this.group.add(this.herb, this.pred);
  }

  update(snap: Snapshot): void {
    this.snap = snap;
    const { size } = snap;
    this.herds = [];
    this.hunters = [];
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const i = y * size + x;
        const h = snap.herb[i];
        // 1 つの記号が、およそ 1 セルあたり 8 頭分の群れを表す
        if (h > 6 && hash2(21, i, 1) < Math.min(0.5, h / 40) && this.herds.length < 700) {
          this.herds.push({ x, y, phase: hash2(22, i, 2) * 6.28, radius: 1.2 });
        }
        const p = snap.pred[i];
        if (p > 0.25 && hash2(23, i, 3) < Math.min(0.6, p) && this.hunters.length < 120) {
          this.hunters.push({ x, y, phase: hash2(24, i, 4) * 6.28, radius: 2 });
        }
      }
    }
    this.herb.count = this.herds.length;
    this.pred.count = this.hunters.length;
  }

  /** 毎フレーム、群れの位置を少しずつ動かす */
  animate(t: number, visible: boolean): void {
    this.group.visible = visible;
    const snap = this.snap;
    if (!visible || !snap) return;
    const { size } = snap;
    const place = (mesh: THREE.InstancedMesh, list: Herd[], speed: number) => {
      for (let k = 0; k < list.length; k++) {
        const hd = list[k];
        const a = t * speed + hd.phase;
        const cx = hd.x + Math.cos(a) * hd.radius;
        const cy = hd.y + Math.sin(a * 0.8) * hd.radius;
        const wy = sampleSurface(snap.height, snap.lake, size, cx, cy);
        const heading = a + Math.PI / 2;
        this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -heading);
        this.m.compose(
          new THREE.Vector3(cellToWorldX(cx, size), Math.max(wy, snap.seaLevel * HEIGHT_SCALE), cellToWorldZ(cy, size)),
          this.q,
          new THREE.Vector3(1, 1, 1)
        );
        mesh.setMatrixAt(k, this.m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    place(this.herb, this.herds, 0.12);
    place(this.pred, this.hunters, 0.2);
  }
}
