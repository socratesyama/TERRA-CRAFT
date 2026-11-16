import * as THREE from 'three';
import type { Snapshot } from '../types/world.ts';
import { colorize } from '../terrain/colors.ts';
import type { ColorOptions, LayerId } from '../terrain/colors.ts';
import { buildTerrainGeometryData, updateTerrainHeights } from '../terrain/mesh.ts';

export class TerrainMesh {
  readonly mesh: THREE.Mesh;
  private geo = new THREE.BufferGeometry();
  private colors = new Float32Array(0);
  private size = 0;

  constructor() {
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      metalness: 0,
    });
    this.mesh = new THREE.Mesh(this.geo, material);
  }

  private ensure(size: number): void {
    if (this.size === size) return;
    const { positions, indices } = buildTerrainGeometryData(size);
    this.colors = new Float32Array(size * size * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geo.setIndex(new THREE.BufferAttribute(indices, 1));
    this.size = size;
  }

  update(snap: Snapshot, layer: LayerId, opts: ColorOptions): void {
    this.ensure(snap.size);
    const pos = this.geo.getAttribute('position') as THREE.BufferAttribute;
    updateTerrainHeights(pos.array as Float32Array, snap.height, snap.lake, snap.size);
    colorize(snap, layer, this.colors, opts);
    pos.needsUpdate = true;
    (this.geo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
  }

  recolor(snap: Snapshot, layer: LayerId, opts: ColorOptions): void {
    if (this.size !== snap.size) return;
    colorize(snap, layer, this.colors, opts);
    (this.geo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
