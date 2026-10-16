/**
 * Procedural wheel and nozzle geometry (lathes), in the body frame:
 * +X left, +Y up, +Z forward, origin at the centre of mass. No external models.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WHEEL_RADIUS } from '../../physics/layout';

/** Low-profile tire as a lathe, axis along X. */
export function tireGeometry(): THREE.BufferGeometry {
  const r = WHEEL_RADIUS;
  const w = 0.14;
  const rim = r - 0.085;
  const prof: THREE.Vector2[] = [
    new THREE.Vector2(rim, -w + 0.01),
    new THREE.Vector2(r - 0.025, -w),
    new THREE.Vector2(r, -w + 0.035),
    new THREE.Vector2(r, w - 0.035),
    new THREE.Vector2(r - 0.025, w),
    new THREE.Vector2(rim, w - 0.01),
  ];
  const g = new THREE.LatheGeometry(prof, 48);
  g.rotateZ(Math.PI / 2);
  return g;
}

/**
 * Wheel face, axis along X, outer face toward +X: a light aero disc behind six pairs of thin
 * dark spokes (a star), a dark rim lip and hub.
 */
export function wheelGeometry(): { disc: THREE.BufferGeometry; dark: THREE.BufferGeometry } {
  const rim = WHEEL_RADIUS - 0.085;
  const disc = new THREE.CylinderGeometry(rim - 0.012, rim - 0.012, 0.03, 48);
  disc.rotateZ(Math.PI / 2);
  disc.translate(0.085, 0, 0);
  const dark: THREE.BufferGeometry[] = [];
  const lip = new THREE.LatheGeometry(
    [
      new THREE.Vector2(rim - 0.016, 0.115),
      new THREE.Vector2(rim + 0.002, 0.118),
      new THREE.Vector2(rim + 0.004, 0.05),
    ],
    48,
  );
  lip.rotateZ(Math.PI / 2);
  dark.push(lip);
  const pairs = 6;
  for (let i = 0; i < pairs; i++) {
    for (const side of [-1, 1]) {
      const len = rim - 0.06;
      const spoke = new THREE.BoxGeometry(0.018, 0.02, len);
      // Taper: narrow at the rim.
      const p = spoke.attributes.position!;
      for (let k = 0; k < p.count; k++) {
        const t = (p.getZ(k) + len / 2) / len;
        p.setY(k, p.getY(k) * (1.3 - 0.7 * t));
      }
      spoke.translate(0, 0, len / 2 + 0.045);
      spoke.rotateX(side * 0.13);
      spoke.translate(0.108, 0, 0);
      spoke.rotateX((i / pairs) * Math.PI * 2);
      dark.push(spoke);
    }
  }
  const hub = new THREE.CylinderGeometry(0.055, 0.06, 0.04, 24);
  hub.rotateZ(Math.PI / 2);
  hub.translate(0.11, 0, 0);
  dark.push(hub);
  return { disc, dark: mergeGeometries(dark.map((g) => g.toNonIndexed()))! };
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
