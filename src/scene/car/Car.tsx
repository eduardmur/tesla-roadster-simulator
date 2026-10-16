/** The car: lofted body, wheels on their suspension, nozzles and plumes, at the sim's pose. */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { host } from '../../app/host';
import {
  BODY,
  DOWN_NOZZLES,
  REAR_NOZZLES,
  SUSPENSION_REST,
  WHEELS,
  YAW_NOZZLES,
} from '../../physics/layout';
import { SPAWNS } from '../../sim/track';
import { PlumeCones } from '../effects/Plumes';
import { bodyGeometry, bodyMaterial } from './body';
import { nozzleGeometry, rimGeometry, tireGeometry } from './geometry';
import { nozzleVisualPosition } from './nozzles';

const getSim = () => host.sim;
const NOZZLES = [...REAR_NOZZLES, ...DOWN_NOZZLES, ...YAW_NOZZLES];
const DOWN = new THREE.Vector3(0, -1, 0);

function useMaterials() {
  return useMemo(
    () => ({
      body: bodyMaterial(),
      tire: new THREE.MeshStandardMaterial({ color: '#0d0d0e', roughness: 0.9 }),
      rim: new THREE.MeshStandardMaterial({ color: '#2a2d32', roughness: 0.35, metalness: 0.9 }),
      dark: new THREE.MeshStandardMaterial({ color: '#0b0c0e', roughness: 0.6, metalness: 0.4 }),
      nozzle: new THREE.MeshStandardMaterial({
        color: '#8a9099',
        roughness: 0.3,
        metalness: 1,
        side: THREE.DoubleSide,
      }),
      front: new THREE.MeshStandardMaterial({
        color: '#fff',
        emissive: '#eaf2ff',
        emissiveIntensity: 3,
        toneMapped: false,
      }),
      rear: new THREE.MeshStandardMaterial({
        color: '#300',
        emissive: '#ff1a1a',
        emissiveIntensity: 3,
        toneMapped: false,
      }),
    }),
    [],
  );
}

export function Car({ carRef }: { carRef: React.RefObject<THREE.Group | null> }) {
  const m = useMaterials();
  const geo = useMemo(
    () => ({
      body: bodyGeometry(),
      tire: tireGeometry(),
      rim: rimGeometry(),
      nozzle: nozzleGeometry(0.03, 0.12),
    }),
    [],
  );
  const wheelRefs = useRef<(THREE.Group | null)[]>([]);
  const spinRefs = useRef<(THREE.Group | null)[]>([]);
  const frost = useMemo(
    () => ({ warm: new THREE.Color('#8a9099'), cold: new THREE.Color('#f4f8ff') }),
    [],
  );

  useFrame(() => {
    const g = carRef.current;
    if (!g) return;
    const sim = host.sim;
    if (sim) {
      const p = sim.renderPose();
      g.position.set(p.pos[0], p.pos[1], p.pos[2]);
      g.quaternion.set(p.rot[0], p.rot[1], p.rot[2], p.rot[3]);
    } else {
      const s = SPAWNS.start;
      g.position.set(s.position[0], BODY.comHeight - 0.035, s.position[2]);
      g.quaternion.identity();
    }
    const t = sim?.telemetry;
    WHEELS.forEach((w, i) => {
      const wg = wheelRefs.current[i];
      const sg = spinRefs.current[i];
      const wt = t?.wheels[i];
      if (!wg || !sg) return;
      wg.position.y = w.anchor[1] - (SUSPENSION_REST - (wt?.compression ?? 0.066));
      wg.rotation.y = wt?.steer ?? 0;
      sg.rotation.x = wt?.spin ?? 0;
    });
    if (t) {
      // The nozzles frost over as the tank gas gets very cold.
      const cold = THREE.MathUtils.clamp((273 - t.tankTemperature) / 70, 0, 1);
      m.nozzle.color.copy(frost.warm).lerp(frost.cold, cold);
      m.nozzle.roughness = 0.3 + 0.6 * cold;
    }
  }, -1);

  return (
    <group ref={carRef}>
      <mesh geometry={geo.body} material={m.body} castShadow receiveShadow />
      {/* Light bars */}
      <mesh position={[0, 0.0, 2.155]} material={m.front}>
        <boxGeometry args={[1.25, 0.018, 0.02]} />
      </mesh>
      <mesh position={[0, 0.1, -2.17]} material={m.rear}>
        <boxGeometry args={[1.6, 0.022, 0.02]} />
      </mesh>
      {/* Floor and rear diffuser */}
      <mesh position={[0, -0.335, 0]} material={m.dark}>
        <boxGeometry args={[1.7, 0.01, 3.8]} />
      </mesh>
      <mesh position={[0, -0.13, -2.15]} material={m.dark}>
        <boxGeometry args={[1.5, 0.18, 0.05]} />
      </mesh>
      {NOZZLES.map((n) => {
        const jet = new THREE.Vector3(...n.direction).multiplyScalar(-1).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(DOWN, jet);
        return (
          <group key={n.id} position={nozzleVisualPosition(n)} quaternion={q}>
            <mesh geometry={geo.nozzle} material={m.nozzle} />
            <mesh position={[0, 0.06, 0]} material={m.dark}>
              <cylinderGeometry args={[0.07, 0.075, 0.09, 24, 1, true]} />
            </mesh>
          </group>
        );
      })}
      {WHEELS.map((w, i) => (
        <group
          key={w.id}
          ref={(el) => {
            wheelRefs.current[i] = el;
          }}
          position={[w.anchor[0], w.anchor[1] - SUSPENSION_REST + 0.066, w.anchor[2]]}
        >
          <group
            ref={(el) => {
              spinRefs.current[i] = el;
            }}
          >
            <mesh geometry={geo.tire} material={m.tire} castShadow />
            <mesh geometry={geo.rim} material={m.rim} scale={[w.anchor[0] > 0 ? 1 : -1, 1, 1]} />
          </group>
        </group>
      ))}
      <PlumeCones sim={getSim} trim="rocket" />
    </group>
  );
}
