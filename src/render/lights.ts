import * as THREE from 'three';

/** 太陽光は南西から（日照の計算と同じ向き） */
export function createLights(): THREE.Object3D[] {
  const hemi = new THREE.HemisphereLight('#bcd7d2', '#26383a', 1.0);
  const sun = new THREE.DirectionalLight('#fff1dc', 2.3);
  sun.position.set(35, 80, 60);
  return [hemi, sun];
}
