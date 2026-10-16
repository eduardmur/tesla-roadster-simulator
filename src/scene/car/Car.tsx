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
import { ARCH_RADIUS, WHEEL_Y, bodyGeometry, bodyMaterial, station } from './body';
import { nozzleGeometry, tireGeometry, wheelGeometry } from './geometry';
import { nozzleVisualPosition } from './nozzles';

const getSim = () => host.sim;
const NOZZLES = [...REAR_NOZZLES, ...DOWN_NOZZLES, ...YAW_NOZZLES];
const DOWN = new THREE.Vector3(0, -1, 0);
const TAIL_Z = -2.17;

function useMaterials() {
  return useMemo(
    () => ({
      body: bodyMaterial(),
      tire: new THREE.MeshStandardMaterial({ color: '#0d0d0e', roughness: 0.9 }),
      disc: new THREE.MeshPhysicalMaterial({
        color: '#d9dcdf',
        roughness: 0.3,
        metalness: 0.2,
        clearcoat: 0.6,
      }),
      gloss: new THREE.MeshPhysicalMaterial({
        color: '#0a0b0c',
        roughness: 0.2,
        metalness: 0.3,
        clearcoat: 1,
      }),
      dark: new THREE.MeshStandardMaterial({ color: '#0b0c0e', roughness: 0.6, metalness: 0.4 }),
      well: new THREE.MeshStandardMaterial({
        color: '#050506',
        roughness: 0.95,
        side: THREE.DoubleSide,
      }),
      nozzle: new THREE.MeshStandardMaterial({
        color: '#8a9099',
        roughness: 0.3,
        metalness: 1,
        side: THREE.DoubleSide,
      }),
      ring: new THREE.MeshStandardMaterial({ color: '#c9ced4', roughness: 0.2, metalness: 1 }),
      plate: new THREE.MeshStandardMaterial({ color: '#d7d9db', roughness: 0.5 }),
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

/** Dark wheelhouse behind each cut-out arch: an open half-drum and an inner wall. */
function wheelhouseGeometry(): THREE.BufferGeometry[] {
  const depth = 0.32;
  // Around the top of the wheel, open at the bottom (theta is measured from the front).
  const drum = new THREE.CylinderGeometry(
    ARCH_RADIUS + 0.005,
    ARCH_RADIUS + 0.005,
    depth,
    32,
    1,
    true,
    Math.PI * (0.5 - 0.6),
    Math.PI * 1.2,
  );
  drum.rotateZ(Math.PI / 2);
  const wall = new THREE.CircleGeometry(ARCH_RADIUS + 0.005, 32);
  wall.rotateY(Math.PI / 2);
  wall.translate(-depth / 2, 0, 0);
  return [drum, wall];
}

export function Car({ carRef }: { carRef: React.RefObject<THREE.Group | null> }) {
  const m = useMaterials();
  const geo = useMemo(
    () => ({
      body: bodyGeometry(),
      tire: tireGeometry(),
      wheel: wheelGeometry(),
      nozzle: nozzleGeometry(0.03, 0.12),
      well: wheelhouseGeometry(),
    }),
    [],
  );
  const wheelRefs = useRef<(THREE.Group | null)[]>([]);
  const spinRefs = useRef<(THREE.Group | null)[]>([]);
  const frost = useMemo(
    () => ({ warm: new THREE.Color('#8a9099'), cold: new THREE.Color('#f4f8ff') }),
    [],
  );
  const details = useMemo(() => {
    const a = station(1.0);
    const r = station(-1.95);
    return {
      camera: { x: a.wbelt + 0.02, y: a.ybelt + 0.015 },
      marker: { x: r.w + 0.003, y: r.ys - 0.035 },
    };
  }, []);

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

      {/* Wheelhouses behind the arch cut-outs */}
      {WHEELS.map((w) => (
        <group
          key={`well-${w.id}`}
          position={[Math.sign(w.anchor[0]) * 0.8, WHEEL_Y, w.anchor[2]]}
          scale={[Math.sign(w.anchor[0]), 1, 1]}
        >
          {geo.well.map((g, i) => (
            <mesh key={i} geometry={g} material={m.well} />
          ))}
        </group>
      ))}

      {/* Front: light bar and a dark lower intake */}
      <mesh position={[0, -0.02, 2.172]} material={m.front}>
        <boxGeometry args={[1.1, 0.016, 0.01]} />
      </mesh>
      <mesh position={[0, -0.17, 2.173]} material={m.gloss}>
        <boxGeometry args={[1.0, 0.07, 0.01]} />
      </mesh>

      {/* Rear: black light band with a full-width red bar (a small ducktail at the corners) */}
      <mesh position={[0, 0.355, TAIL_Z + 0.01]} material={m.gloss}>
        <boxGeometry args={[1.84, 0.1, 0.1]} />
      </mesh>
      <mesh position={[0, 0.36, TAIL_Z - 0.045]} material={m.rear}>
        <boxGeometry args={[1.66, 0.024, 0.012]} />
      </mesh>
      {/* Blank plate */}
      <mesh position={[0, 0.17, TAIL_Z - 0.004]} material={m.gloss}>
        <boxGeometry args={[0.5, 0.13, 0.006]} />
      </mesh>
      <mesh position={[0, 0.17, TAIL_Z - 0.008]} material={m.plate}>
        <boxGeometry args={[0.47, 0.105, 0.006]} />
      </mesh>
      {/* Diffuser: the four rear thrusters sit in its face, fins below */}
      <mesh position={[0, -0.16, TAIL_Z + 0.02]} material={m.gloss}>
        <boxGeometry args={[1.62, 0.42, 0.18]} />
      </mesh>
      {REAR_NOZZLES.map((n) => (
        <mesh
          key={`ring-${n.id}`}
          position={[n.position[0], n.position[1], TAIL_Z - 0.072]}
          material={m.ring}
        >
          <torusGeometry args={[0.058, 0.009, 10, 32]} />
        </mesh>
      ))}
      {[-0.42, 0, 0.42].map((x) => (
        <mesh
          key={`sensor-${x}`}
          position={[x, -0.12, TAIL_Z - 0.071]}
          rotation-x={Math.PI / 2}
          material={m.dark}
        >
          <cylinderGeometry args={[0.022, 0.022, 0.01, 20]} />
        </mesh>
      ))}
      {[-0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6].map((x) => (
        <mesh key={`fin-${x}`} position={[x, -0.29, TAIL_Z - 0.09]} material={m.gloss}>
          <boxGeometry args={[0.012, 0.15, 0.22]} />
        </mesh>
      ))}

      {/* Small side cameras ahead of the windows, red side markers at the rear */}
      {[-1, 1].map((s) => (
        <group key={`side-${s}`}>
          <mesh position={[s * details.camera.x, details.camera.y, 1.0]} material={m.gloss}>
            <boxGeometry args={[0.05, 0.03, 0.08]} />
          </mesh>
          <mesh position={[s * details.marker.x, details.marker.y, -1.95]} material={m.rear}>
            <boxGeometry args={[0.004, 0.022, 0.08]} />
          </mesh>
        </group>
      ))}

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
            <group scale={[w.anchor[0] > 0 ? 1 : -1, 1, 1]}>
              <mesh geometry={geo.wheel.disc} material={m.disc} />
              <mesh geometry={geo.wheel.dark} material={m.gloss} />
            </group>
          </group>
        </group>
      ))}
      <PlumeCones sim={getSim} trim="rocket" />
    </group>
  );
}
