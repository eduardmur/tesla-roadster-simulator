/** The live car: places the model at the sim's (interpolated) pose and adds plumes, map, hotspots. */
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { host } from '../../app/host';
import { componentsFor } from '../../data/components';
import { BODY } from '../../physics/layout';
import { SPAWNS } from '../../sim/track';
import { useApp } from '../../state/store';
import { PlumeCones } from '../effects/Plumes';
import { PressureMap } from '../effects/Suction';
import { CarModel, GhostCarModel } from './CarModel';

const getSim = () => host.sim;
const getTelemetry = () => host.sim?.telemetry ?? null;

export function Car({ carRef }: { carRef: React.RefObject<THREE.Group | null> }) {
  const trim = useApp((s) => s.trim);
  const xray = useApp((s) => s.xray || s.camera === 'engineer');
  const exploded = useApp((s) => s.exploded);
  const reducedMotion = useApp((s) => s.reducedMotion);
  const showHotspots = useApp((s) => s.xray || s.labOpen);

  useFrame(() => {
    const g = carRef.current;
    if (!g) return;
    const sim = host.sim;
    if (sim) {
      const p = sim.renderPose();
      g.position.set(p.pos[0], p.pos[1], p.pos[2]);
      g.quaternion.set(p.rot[0], p.rot[1], p.rot[2], p.rot[3]);
    } else {
      const s = SPAWNS.hub;
      g.position.set(s.position[0], BODY.comHeight - 0.035, s.position[2]);
      g.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.yaw);
    }
  }, -1);

  return (
    <group ref={carRef}>
      <CarModel
        trim={trim}
        xray={xray}
        exploded={exploded}
        telemetry={getTelemetry}
        reducedMotion={reducedMotion}
      />
      <PlumeCones sim={getSim} trim={trim} />
      {xray && <PressureMap sim={getSim} />}
      {showHotspots && <Hotspots />}
    </group>
  );
}

function Hotspots() {
  const trim = useApp((s) => s.trim);
  const active = useApp((s) => s.hotspot);
  const set = useApp((s) => s.set);
  return (
    <>
      {componentsFor(trim).map((c) => (
        <Html
          key={c.id}
          position={c.position}
          center
          zIndexRange={[20, 10]}
          style={{ pointerEvents: 'auto' }}
        >
          <button
            type="button"
            className={`hotspot hotspot--${c.group}${active === c.id ? ' is-active' : ''}`}
            aria-label={`${c.label}: open details`}
            onClick={() => set({ hotspot: c.id, labOpen: true, labTab: 'telemetry' })}
          >
            <span className="hotspot__dot" aria-hidden="true" />
            <span className="hotspot__label">{c.label}</span>
          </button>
        </Html>
      ))}
    </>
  );
}

/** Translucent replay of the autopilot's Curl run, shown during "Your turn". */
export function GhostCar() {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const p = host.ghostPose();
    g.visible = !!p;
    if (p) {
      g.position.set(...p.pos);
      g.quaternion.set(...p.rot);
    }
  });
  return (
    <group ref={ref} visible={false}>
      <GhostCarModel />
    </group>
  );
}
