/**
 * Cameras. Driving to the ramp uses a chase camera; once the car is on the curl it cuts between
 * fixed "film" shots like the reveal footage (beside the ramp, the drop, the landing), then a
 * slow orbit. Driving on after a run is back to the chase camera. A director override exists
 * for scripted captures.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { host } from '../../app/host';
import { useApp } from '../../state/store';
import { director } from './director';

type ShotId = 'idle' | 'side' | 'flight' | 'landing' | 'done' | 'chase';

const WORLD_UP = new THREE.Vector3(0, 1, 0);

export function CameraRig({ carRef }: { carRef: React.RefObject<THREE.Group | null> }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const v = useMemo(
    () => ({
      pos: new THREE.Vector3(),
      look: new THREE.Vector3(),
      smoothLook: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
      fwd: new THREE.Vector3(),
      carUp: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      anchor: new THREE.Vector3(),
      init: false,
    }),
    [],
  );
  const shotRef = useRef<ShotId | null>(null);
  const orbit = useRef(0);

  useFrame((state, rawDt) => {
    const car = carRef.current;
    if (!car) return;
    const dt = Math.min(rawDt, 0.05);
    const app = useApp.getState();
    const t = host.sim?.telemetry;
    car.getWorldQuaternion(v.q);
    v.fwd.set(0, 0, 1).applyQuaternion(v.q);
    v.carUp.set(0, 1, 0).applyQuaternion(v.q);
    const p = car.position;

    // Pick the shot.
    let shot: ShotId;
    if (app.mode === 'done') shot = 'done';
    else if (app.mode === 'idle') shot = 'idle';
    else if (app.stage === 'flight')
      shot = t && t.altitude < 6 && t.velocity[1] < 0 ? 'landing' : 'flight';
    else if (app.stage === 'climb' || app.stage === 'inverted') shot = 'side';
    else shot = 'chase';
    const prev = shotRef.current;
    // Film shots cut; pulling away into the chase camera eases from wherever the camera was.
    const cut = shot !== prev && !(shot === 'chase' && (prev === 'idle' || prev === 'done'));
    if (shot !== prev) {
      shotRef.current = shot;
      // Low on the runway, between the lamp rows, looking back at the car.
      if (shot === 'landing') v.anchor.set(p.x + 4.5, 1.1, p.z - 13);
      if (shot === 'done')
        orbit.current = Math.atan2(camera.position.z - p.z, camera.position.x - p.x);
    }

    let fov = 45;
    let stiffness = 4;
    let targetUp = WORLD_UP;
    switch (shot) {
      case 'idle': {
        // Low behind the car, the ramp towering ahead (pulled back on tall, narrow screens).
        const narrow = state.size.width < state.size.height;
        v.pos.set(p.x - (narrow ? 0.6 : 1.8), narrow ? 1.6 : 1.0, p.z - (narrow ? 11 : 7.5));
        v.look.set(0, narrow ? 2.2 : 4.5, p.z + 14);
        fov = narrow ? 62 : 50;
        break;
      }
      case 'side':
        v.pos.set(26, 7, -9);
        v.look.copy(p);
        fov = 48;
        break;
      case 'flight':
        v.pos.set(24, 6, -22);
        v.look.copy(p);
        fov = 46;
        break;
      case 'landing':
        v.pos.copy(v.anchor);
        v.look.copy(p);
        fov = 42;
        break;
      case 'done': {
        if (!app.reducedMotion) orbit.current += dt * 0.12;
        const a = orbit.current;
        v.pos.set(p.x + Math.cos(a) * 9, p.y + 1.8, p.z + Math.sin(a) * 9);
        v.look.set(p.x, p.y + 0.3, p.z);
        fov = 40;
        stiffness = 2;
        break;
      }
      case 'chase': {
        const onSurface = (t?.wheelsInContact ?? 4) >= 2;
        const up = onSurface && !app.reducedMotion ? v.carUp : WORLD_UP;
        targetUp = up;
        v.pos.copy(p).addScaledVector(v.fwd, -6.8).addScaledVector(up, 2.0);
        v.look.copy(p).addScaledVector(up, 0.7).addScaledVector(v.fwd, 2.5);
        fov = 55;
        stiffness = 6;
        break;
      }
    }

    // Scripted captures can override the shot.
    const s = director.shot;
    if (s) {
      v.pos.set(...s.position);
      if (s.lookAt === 'car') v.look.copy(p);
      else v.look.set(...s.lookAt);
      fov = s.fov ?? fov;
    }

    // Gentle shake with thrust (never with reduced motion).
    if (!app.reducedMotion && t) {
      const amp = Math.min((t.rearThrust + t.liftThrust) / 80_000, 1.2) * 0.04;
      if (amp > 0.001) {
        const time = state.clock.elapsedTime;
        v.pos.x += Math.sin(time * 47) * amp;
        v.pos.y += Math.sin(time * 61 + 1) * amp;
      }
    }

    const hard = cut || director.cut || !v.init;
    director.cut = false;
    const k = hard ? 1 : 1 - Math.exp(-stiffness * dt);
    camera.position.lerp(v.pos, k);
    v.smoothLook.lerp(v.look, hard ? 1 : Math.min(1, k * 1.8));
    v.up.lerp(targetUp, hard ? 1 : 1 - Math.exp(-3 * dt)).normalize();
    camera.up.copy(v.up);
    camera.lookAt(v.smoothLook);
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov = hard ? fov : camera.fov + (fov - camera.fov) * Math.min(1, dt * 4);
      camera.updateProjectionMatrix();
    }
    v.init = true;
  }, 0);

  return null;
}
