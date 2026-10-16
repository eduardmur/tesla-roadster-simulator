import * as THREE from 'three';
import type { NozzleLayout } from '../../physics/layout';
import { station } from './body';

/** Visual nozzle positions sit on the skin; physics positions are the force points. */
export function nozzleVisualPosition(n: NozzleLayout): THREE.Vector3 {
  const p = new THREE.Vector3(...n.position);
  // Sit on the body surface (see the lofted body's lower half-width at that station).
  const st = station(p.z);
  if (n.id.startsWith('Y-')) p.x = Math.sign(n.direction[0]) * -(st.w - 0.05);
  if (n.id.startsWith('D-')) {
    p.y = st.yb - 0.005;
    p.x = Math.sign(p.x) * Math.min(Math.abs(p.x), st.wl - 0.1);
  }
  // In the face of the rear diffuser.
  if (n.id.startsWith('R')) p.z = -2.23;
  return p;
}
