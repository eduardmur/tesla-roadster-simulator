import * as THREE from 'three';
import type { NozzleLayout } from '../../physics/layout';
import { station } from './body';

/** Visual nozzle positions sit on the skin; physics positions are the force points. */
export function nozzleVisualPosition(n: NozzleLayout): THREE.Vector3 {
  const p = new THREE.Vector3(...n.position);
  // Sit on the body surface (see the lofted body's lower half-width at that station).
  const st = station(p.z);
  if (n.id.startsWith('Y-')) p.x = Math.sign(n.direction[0]) * -(st.wl - 0.03);
  if (n.id.startsWith('D-')) {
    p.y = -0.31;
    p.x = Math.sign(p.x) * Math.min(Math.abs(p.x), st.wl - 0.1);
  }
  if (n.id.startsWith('R')) p.z = -2.2;
  return p;
}
