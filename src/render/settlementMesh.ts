import * as THREE from 'three';
import type { Snapshot } from '../types/world.ts';
import { sampleSurface, cellToWorldX, cellToWorldZ, WORLD_SIZE } from '../terrain/mesh.ts';
import { hash2 } from '../utils/random.ts';

const MAX_HOUSES = 1400;

/** 集落の家並み。規模に応じて家が増え、灯りがともる。 */
export class SettlementLayer {
  readonly mesh: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private col = new THREE.Color();

  constructor() {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    this.mesh = new THREE.InstancedMesh(
      geo,
      new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#f4a261', emissiveIntensity: 0.5, roughness: 0.7 }),
      MAX_HOUSES
    );
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
  }

  update(snap: Snapshot): void {
    const { size } = snap;
    const cell = WORLD_SIZE / (size - 1);
    let n = 0;
    for (const s of snap.settlements) {
      const count = s.level === 3 ? 26 : s.level === 2 ? 10 : 4;
      const spread = (s.level === 3 ? 2.6 : s.level === 2 ? 1.8 : 1.1) * cell;
      for (let k = 0; k < count && n < MAX_HOUSES; k++) {
        const id = s.x * 977 + s.y * 31 + k;
        const ang = hash2(31, id, 1) * Math.PI * 2;
        const rad = Math.sqrt(hash2(32, id, 2)) * spread;
        const wx = cellToWorldX(s.x, size) + Math.cos(ang) * rad;
        const wz = cellToWorldZ(s.y, size) + Math.sin(ang) * rad;
        const cx = s.x + (Math.cos(ang) * rad) / cell;
        const cy = s.y + (Math.sin(ang) * rad) / cell;
        const wy = sampleSurface(snap.height, snap.lake, size, cx, cy);
        const w = 0.5 + hash2(33, id, 3) * (s.level === 3 ? 0.7 : 0.4);
        const h = 0.5 + hash2(34, id, 4) * (s.level === 3 ? 2.6 : s.level === 2 ? 1.1 : 0.5);
        this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash2(35, id, 5) * Math.PI);
        this.m.compose(new THREE.Vector3(wx, wy, wz), this.q, new THREE.Vector3(w, h, w));
        this.mesh.setMatrixAt(n, this.m);
        this.col.set(s.level === 3 ? '#e76f51' : '#f4a261');
        this.mesh.setColorAt(n, this.col);
        n++;
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
