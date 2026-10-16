/**
 * Cameras: chase, cinematic orbit, on-board and engineer cutaway, plus "shots" the tour and
 * landing page put on rails. Gentle thrust shake, disabled with prefers-reduced-motion.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { host } from '../../app/host';
import { useApp } from '../../state/store';
import { director, type CameraShot } from './director';

const WORLD_UP = new THREE.Vector3(0, 1, 0);

export function CameraRig({ carRef }: { carRef: React.RefObject<THREE.Group | null> }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const mode = useApp((s) => s.camera);
  const xray = useApp((s) => s.xray);
  const reducedMotion = useApp((s) => s.reducedMotion);
  const v = useMemo(
    () => ({
      pos: new THREE.Vector3(),
      look: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
      fwd: new THREE.Vector3(),
      carUp: new THREE.Vector3(),
      left: new THREE.Vector3(),
      tmp: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      smoothLook: new THREE.Vector3(),
      init: false,
    }),
    [],
  );
  const orbitAngle = useRef(0.8);

  useFrame((state, rawDt) => {
    const car = carRef.current;
    if (!car) return;
    const dt = Math.min(rawDt, 0.05);
    const t = host.sim?.telemetry;
    car.getWorldQuaternion(v.q);
    v.fwd.set(0, 0, 1).applyQuaternion(v.q);
    v.carUp.set(0, 1, 0).applyQuaternion(v.q);
    v.left.set(1, 0, 0).applyQuaternion(v.q);
    const carPos = car.position;
    const shot: CameraShot =
      director.shot ??
      (mode === 'chase'
        ? { kind: 'chase' }
        : mode === 'orbit'
          ? { kind: 'orbit', radius: xray ? 6.4 : 9, height: xray ? 2.2 : 2.6, speed: 0.18 }
          : mode === 'onboard'
            ? { kind: 'carFrame', offset: [0.4, 0.42, 0.0], look: [0.4, 0.38, 10], fov: 72 }
            : { kind: 'carFrame', offset: [14, 1.2, 0], look: [0, 0, 0], fov: 24 });

    let fov = 52;
    let stiffness = reducedMotion ? 3 : 6;
    let targetUp = WORLD_UP;
    const onSurface = (t?.wheelsInContact ?? 4) >= 2;

    switch (shot.kind) {
      case 'chase': {
        const up = onSurface && !reducedMotion ? v.carUp : WORLD_UP;
        targetUp = up;
        // Behind the car along its own forward axis.
        v.pos.copy(carPos).addScaledVector(v.fwd, -6.8).addScaledVector(up, 2.1);
        v.look.copy(carPos).addScaledVector(up, 0.7).addScaledVector(v.fwd, 2.5);
        fov = 55;
        break;
      }
      case 'orbit': {
        orbitAngle.current += dt * shot.speed * (reducedMotion ? 0.4 : 1);
        const a = orbitAngle.current;
        v.pos.set(
          carPos.x + Math.cos(a) * shot.radius,
          carPos.y + shot.height,
          carPos.z + Math.sin(a) * shot.radius,
        );
        v.look.copy(carPos).add(v.tmp.set(0, 0.35, 0));
        fov = shot.fov ?? 42;
        stiffness = 3;
        break;
      }
      case 'carFrame': {
        const up = mode === 'onboard' && !director.shot ? v.carUp : WORLD_UP;
        targetUp = up;
        v.pos
          .copy(carPos)
          .addScaledVector(v.left, shot.offset[0])
          .addScaledVector(
            mode === 'onboard' && !director.shot ? v.carUp : WORLD_UP,
            shot.offset[1],
          )
          .addScaledVector(v.fwd, shot.offset[2]);
        v.look
          .copy(carPos)
          .addScaledVector(v.left, shot.look[0])
          .addScaledVector(v.carUp, shot.look[1])
          .addScaledVector(v.fwd, shot.look[2]);
        fov = shot.fov ?? 50;
        stiffness = mode === 'onboard' && !director.shot ? 40 : 5;
        break;
      }
      case 'world': {
        v.pos.set(...shot.position);
        if (shot.lookAt === 'car') v.look.copy(carPos);
        else v.look.set(...shot.lookAt);
        fov = shot.fov ?? 45;
        stiffness = 2.5;
        break;
      }
    }

    // Shake from thrust (off for reduced motion).
    if (!reducedMotion && t) {
      const thrust = t.rearThrust + t.liftThrust;
      const amp = Math.min(thrust / 80_000, 1.2) * 0.05;
      if (amp > 0.001) {
        const time = state.clock.elapsedTime;
        v.pos.x += Math.sin(time * 47) * amp;
        v.pos.y += Math.sin(time * 61 + 1) * amp;
        v.pos.z += Math.sin(time * 53 + 2) * amp;
      }
    }

    const k = director.cut || !v.init ? 1 : 1 - Math.exp(-stiffness * dt);
    director.cut = false;
    camera.position.lerp(v.pos, k);
    v.smoothLook.lerp(v.look, v.init ? Math.min(1, k * 1.6) : 1);
    v.up.lerp(targetUp, 1 - Math.exp(-(reducedMotion ? 1.5 : 3) * dt)).normalize();
    camera.up.copy(v.up);
    camera.lookAt(v.smoothLook);
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov += (fov - camera.fov) * Math.min(1, dt * 4);
      camera.updateProjectionMatrix();
    }
    v.init = true;
    // Priority 0: runs after the car pose (−1) without taking over rendering.
  }, 0);

  return null;
}
