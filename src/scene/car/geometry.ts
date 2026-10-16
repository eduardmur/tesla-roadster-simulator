/**
 * Procedural wheel and nozzle geometry (lathes), in the body frame:
 * +X left, +Y up, +Z forward, origin at the centre of mass. No external models.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WHEEL_RADIUS } from '../../physics/layout';

/** Tire as a lathe, axis along X. */
export function tireGeometry(): THREE.BufferGeometry {
  const r = WHEEL_RADIUS;
  const w = 0.14;
  const prof: THREE.Vector2[] = [
    new THREE.Vector2(r - 0.1, -w),
    new THREE.Vector2(r - 0.02, -w),
    new THREE.Vector2(r, -w + 0.04),
    new THREE.Vector2(r, w - 0.04),
    new THREE.Vector2(r - 0.02, w),
    new THREE.Vector2(r - 0.1, w),
  ];
  const g = new THREE.LatheGeometry(prof, 40);
  g.rotateZ(Math.PI / 2);
  return g;
}

/** Turbine-style rim, axis along X. */
export function rimGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const disc = new THREE.CylinderGeometry(WHEEL_RADIUS - 0.1, WHEEL_RADIUS - 0.1, 0.05, 40);
  disc.rotateZ(Math.PI / 2);
  disc.translate(0.06, 0, 0);
  parts.push(disc);
  const n = 12;
  for (let i = 0; i < n; i++) {
    const blade = new THREE.BoxGeometry(0.03, 0.035, WHEEL_RADIUS - 0.13);
    blade.translate(0, 0, (WHEEL_RADIUS - 0.13) / 2 + 0.05);
    blade.rotateY(0.25);
    blade.translate(0.1, 0, 0);
    blade.rotateX((i / n) * Math.PI * 2);
    parts.push(blade);
  }
  const hub = new THREE.CylinderGeometry(0.06, 0.06, 0.06, 20);
  hub.rotateZ(Math.PI / 2);
  hub.translate(0.11, 0, 0);
  parts.push(hub);
  return mergeGeometries(parts.map((g) => g.toNonIndexed()))!;
}

/** Converging–diverging nozzle bell. Axis along +Y (exit at y = 0, inlet above). */
export function nozzleGeometry(exitRadius: number, length: number): THREE.BufferGeometry {
  const throat = exitRadius / Math.sqrt(8);
  const prof: THREE.Vector2[] = [];
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // Bell from throat (t = 0) to exit (t = 1).
    const r = throat + (exitRadius - throat) * Math.pow(t, 0.7);
    prof.push(new THREE.Vector2(r, length * 0.55 * (1 - t)));
  }
  // Converging inlet above the throat.
  prof.unshift(new THREE.Vector2(throat * 2.2, length));
  prof.unshift(new THREE.Vector2(throat * 2.4, length * 1.05));
  const g = new THREE.LatheGeometry(prof.reverse(), 24);
  return g;
}
