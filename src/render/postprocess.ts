import * as THREE from 'three';

/** 階調と色空間の設定。映画的なトーンマッピングで、明暗の差を自然に出す。 */
export function setupColorPipeline(renderer: THREE.WebGLRenderer): void {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
}
