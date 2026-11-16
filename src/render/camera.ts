import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function createCamera(aspect: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(40, aspect, 0.5, 900);
  camera.position.set(0, 74, 98);
  return camera;
}

export function createControls(camera: THREE.Camera, dom: HTMLElement): OrbitControls {
  const c = new OrbitControls(camera, dom);
  c.enableDamping = true;
  c.dampingFactor = 0.08;
  c.minDistance = 28;
  c.maxDistance = 230;
  c.maxPolarAngle = Math.PI * 0.49;
  c.target.set(0, 3, 0);
  c.autoRotateSpeed = 0.7;
  return c;
}

/** orbit=true: 1 本指/左ドラッグで回す。false: 描画ツールが 1 本指/左ドラッグを使い、回すのは右ドラッグか 2 本指。 */
export function setControlMode(c: OrbitControls, orbit: boolean): void {
  c.mouseButtons = {
    LEFT: orbit ? THREE.MOUSE.ROTATE : (null as unknown as THREE.MOUSE),
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: orbit ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
  };
  c.touches = {
    ONE: orbit ? THREE.TOUCH.ROTATE : (null as unknown as THREE.TOUCH),
    TWO: THREE.TOUCH.DOLLY_ROTATE,
  };
}
