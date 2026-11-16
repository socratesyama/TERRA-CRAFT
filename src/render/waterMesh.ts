import * as THREE from 'three';
import { HEIGHT_SCALE, WORLD_SIZE } from '../terrain/mesh.ts';

/** 海面。地図の外まで広げて、水平線まで海が続いて見えるようにする。 */
export class Ocean {
  readonly mesh: THREE.Mesh;

  constructor() {
    const geo = new THREE.PlaneGeometry(WORLD_SIZE * 3, WORLD_SIZE * 3, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: '#1b4965',
        transparent: true,
        opacity: 0.84,
        roughness: 0.22,
        metalness: 0.1,
      })
    );
  }

  setLevel(seaLevel: number): void {
    this.mesh.position.y = seaLevel * HEIGHT_SCALE + 0.05;
  }
}

/** 雨粒。降水があるあいだ斜めに降る（西風）。 */
export class RainFx {
  readonly lines: THREE.LineSegments;
  private pos: Float32Array;
  private speeds: Float32Array;
  private opacity = 0;
  private readonly count = 900;

  constructor() {
    this.pos = new Float32Array(this.count * 6);
    this.speeds = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) this.reset(i, true);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.lines = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: '#bfe6f5', transparent: true, opacity: 0 })
    );
    this.lines.frustumCulled = false;
  }

  private reset(i: number, spread: boolean): void {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 1.3;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 1.3;
    const y = spread ? Math.random() * 70 : 70 + Math.random() * 10;
    const o = i * 6;
    this.pos[o] = x;
    this.pos[o + 1] = y;
    this.pos[o + 2] = z;
    this.pos[o + 3] = x + 0.5;
    this.pos[o + 4] = y - 2.4;
    this.pos[o + 5] = z;
    this.speeds[i] = 55 + Math.random() * 25;
  }

  update(dt: number, active: boolean): void {
    this.opacity += ((active ? 0.55 : 0) - this.opacity) * Math.min(1, dt * 3);
    (this.lines.material as THREE.LineBasicMaterial).opacity = this.opacity;
    this.lines.visible = this.opacity > 0.01;
    if (!this.lines.visible) return;
    for (let i = 0; i < this.count; i++) {
      const o = i * 6;
      const d = this.speeds[i] * dt;
      this.pos[o + 1] -= d;
      this.pos[o + 4] -= d;
      this.pos[o] += d * 0.12;
      this.pos[o + 3] += d * 0.12;
      if (this.pos[o + 4] < -2) this.reset(i, false);
    }
    (this.lines.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }
}
