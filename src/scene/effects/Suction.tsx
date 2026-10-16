/** Suction visuals: dust pulled in under the skirts, and the underbody pressure map (X-ray). */
import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { SKIRT_PROBES } from '../../physics/layout';
import type { Sim } from '../../sim/world';
import { FLOOR_Y } from '../car/geometry';

export function SuctionDust({
  sim,
  maxParticles,
  carGroup,
}: {
  sim: () => Sim | null;
  maxParticles: number;
  carGroup: React.RefObject<THREE.Group | null>;
}) {
  const p = useMemo(() => {
    const n = maxParticles;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const life = new Float32Array(n);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute float aLife;
        varying float vLife;
        void main() {
          vLife = aLife;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = 0.12 * (600.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vLife;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.1, d) * vLife * 0.55;
          if (a < 0.01) discard;
          gl_FragColor = vec4(0.78, 0.62, 0.45, a);
        }
      `,
      transparent: true,
      depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    return {
      pts,
      pos,
      life,
      vel: new Float32Array(n * 3),
      age: new Float32Array(n),
      next: 0,
      acc: 0,
    };
  }, [maxParticles]);
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), c: new THREE.Vector3() }), []);

  useFrame((_, dt) => {
    const s = sim();
    const car = carGroup.current;
    const step = Math.min(dt, 0.05) * (s?.paused ? 0 : (s?.timeScale ?? 1));
    const t = s?.telemetry;
    if (s && car && t && step > 0 && t.wheelsInContact >= 3 && t.deltaP > 2000) {
      p.acc += Math.min(t.deltaP / 11500, 1) * 70 * step;
      while (p.acc >= 1) {
        p.acc -= 1;
        const i = p.next;
        p.next = (p.next + 1) % maxParticles;
        // A point just outside the skirt rectangle, at road level.
        const side = Math.floor(Math.random() * 4);
        const u = Math.random() * 2 - 1;
        const out = 0.4 + Math.random() * 1.2;
        const lx = side < 2 ? (side === 0 ? 1 : -1) * (0.8 + out) : u * 0.8;
        const lz = side >= 2 ? (side === 2 ? 1 : -1) * (1.25 + out) : u * 1.25;
        tmp.a.set(lx, FLOOR_Y - 0.06, lz).applyMatrix4(car.matrixWorld);
        tmp.c.set(lx * 0.2, FLOOR_Y - 0.03, lz * 0.2).applyMatrix4(car.matrixWorld);
        const dir = tmp.c.clone().sub(tmp.a).normalize();
        const speed = 1.5 + Math.random() * 2;
        p.pos[i * 3] = tmp.a.x;
        p.pos[i * 3 + 1] = tmp.a.y;
        p.pos[i * 3 + 2] = tmp.a.z;
        p.vel[i * 3] = dir.x * speed + t.velocity[0];
        p.vel[i * 3 + 1] = dir.y * speed + t.velocity[1];
        p.vel[i * 3 + 2] = dir.z * speed + t.velocity[2];
        p.age[i] = 0.001;
      }
    }
    for (let i = 0; i < maxParticles; i++) {
      if (p.age[i]! <= 0) continue;
      p.age[i] = p.age[i]! + step;
      if (p.age[i]! > 0.7) {
        p.age[i] = 0;
        p.life[i] = 0;
        continue;
      }
      for (let c = 0; c < 3; c++) p.pos[i * 3 + c] = p.pos[i * 3 + c]! + p.vel[i * 3 + c]! * step;
      const r = p.age[i]! / 0.7;
      p.life[i] = Math.min(1, r * 5) * (1 - r);
    }
    (p.pts.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (p.pts.geometry.attributes.aLife as THREE.BufferAttribute).needsUpdate = true;
  });

  return <primitive object={p.pts} />;
}

/**
 * Underbody pressure map: suction strength across the floor, from the 8 skirt probes
 * (inverse-distance weighted seal quality × Δp). Cividis colours are colour-blind safe.
 */
export function PressureMap({ sim }: { sim: () => Sim | null }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uDp: { value: 0 },
          uSeal: { value: new Array(8).fill(1) },
          uProbe: { value: SKIRT_PROBES.map((q) => new THREE.Vector2(q[0], q[2])) },
        },
        vertexShader: /* glsl */ `
          varying vec2 vXZ;
          void main() {
            vXZ = vec2(position.x, -position.y);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uDp;
          uniform float uSeal[8];
          uniform vec2 uProbe[8];
          varying vec2 vXZ;
          vec3 cividis(float t) {
            t = clamp(t, 0.0, 1.0);
            vec3 a = vec3(0.0, 0.135, 0.304);
            vec3 b = vec3(0.486, 0.482, 0.471);
            vec3 c = vec3(1.0, 0.917, 0.27);
            return t < 0.5 ? mix(a, b, t * 2.0) : mix(b, c, t * 2.0 - 1.0);
          }
          void main() {
            float wsum = 0.0, q = 0.0;
            for (int i = 0; i < 8; i++) {
              float d = distance(vXZ, uProbe[i]) + 0.15;
              float w = 1.0 / (d * d);
              wsum += w;
              q += w * uSeal[i];
            }
            float v = uDp * (q / wsum);
            float bands = smoothstep(0.02, 0.0, abs(fract(v * 8.0) - 0.5) - 0.46);
            vec3 col = cividis(v) + bands * 0.15;
            gl_FragColor = vec4(col, 0.6);
          }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );

  useFrame(() => {
    const s = sim();
    if (!s) return;
    const t = s.telemetry;
    material.uniforms.uDp!.value = Math.min(t.deltaP / s.params.suctionTarget, 1);
    const res = s.params.suction.residualGap;
    const seal = material.uniforms.uSeal!.value as number[];
    t.probeGaps.forEach((g, i) => {
      seal[i] = 1 / (1 + Math.max(g / res - 1, 0) * 0.5);
    });
  });

  return (
    <mesh
      position={[0, FLOOR_Y - 0.02, 0]}
      rotation-x={-Math.PI / 2}
      material={material}
      renderOrder={20}
    >
      <planeGeometry args={[1.6, 2.5]} />
    </mesh>
  );
}
