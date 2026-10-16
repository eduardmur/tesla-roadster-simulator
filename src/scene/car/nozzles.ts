import * as THREE from 'three';
import type { NozzleLayout } from '../../physics/layout';

/** Visual nozzle positions sit on the skin; physics positions are the force points. */
export function nozzleVisualPosition(n: NozzleLayout): THREE.Vector3 {
  const p = new THREE.Vector3(...n.position);
  if (n.id.startsWith('Y-')) p.x = Math.sign(n.direction[0]) * -0.98;
  if (n.id.startsWith('D-')) p.y = -0.31;
  if (n.id.startsWith('R')) p.z = -2.1;
  return p;
}
