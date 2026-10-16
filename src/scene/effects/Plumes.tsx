/**
 * Cold-gas plumes. Each nozzle gets an additive cone whose length/opacity follow its live
 * thrust, with shock diamonds spaced by the rule of thumb x ≈ 0.67·D·√(p_e/p_a); plus a
 * cloud of condensation particles in world space.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { DOWN_NOZZLES, REAR_NOZZLES, YAW_NOZZLES, type NozzleLayout } from '../../physics/layout';
import { firstShockDiamondDistance, nozzlePerformance } from '../../physics/nozzle';
import type { TrimId } from '../../physics/params';
import type { Sim } from '../../sim/world';
import { useApp } from '../../state/store';
import { nozzleVisualPosition } from '../car/nozzles';

const plumeVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const plumeFragment = /* glsl */ `
  uniform float uIntensity;
  uniform float uTime;
  uniform float uCells;
  uniform float uOpen;
  varying vec2 vUv;
  void main() {
    float s = 1.0 - vUv.y; // 0 at the nozzle, 1 at the tip
    float core = pow(1.0 - s, 1.6);
    float edge = sin(vUv.x * 3.14159 * 2.0 * 3.0 + uTime * 30.0) * 0.08;
    float diamonds = 0.5 + 0.5 * cos(6.28318 * s * uCells);
    float dAmp = exp(-s * 5.0);
    float flicker = 0.85 + 0.15 * sin(uTime * 90.0 + s * 20.0);
    float a = uIntensity * (core * (0.55 + 0.45 * uOpen) + diamonds * dAmp * 0.9) * flicker + edge * core * uIntensity;
    vec3 col = mix(vec3(0.95, 0.97, 1.0), vec3(0.62, 0.8, 1.0), dAmp * diamonds);
    gl_FragColor = vec4(col * a, a);
  }
`;

interface PlumeSlot {
  nozzle: NozzleLayout;
  holder: THREE.Group;
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  smooth: number;
}

function nozzlesFor(trim: TrimId): NozzleLayout[] {
  const list: NozzleLayout[] = [];
  if (trim !== 'performance') list.push(...REAR_NOZZLES);
  if (trim === 'rocket') list.push(...DOWN_NOZZLES, ...YAW_NOZZLES);
  return list;
}

const maxThrustFor = (id: string) =>
  id.startsWith('R') ? 20_000 : id.startsWith('D') ? 19_000 : 2_500;
const kindFor = (id: string) => (id.startsWith('R') ? 'rear' : id.startsWith('D') ? 'down' : 'yaw');

/** Thrust fraction of a nozzle right now (0..~1). */
function thrustFraction(sim: Sim | null, id: string): { k: number; open: boolean } {
  const nt = sim?.telemetry.nozzles.find((x) => x.id === id);
  return { k: nt ? Math.min(nt.thrust / maxThrustFor(id), 1.2) : 0, open: !!nt?.open };
}

/** Plume cones; render this inside the car's group so they move with it. */
export function PlumeCones({ sim, trim }: { sim: () => Sim | null; trim: TrimId }) {
  const coneGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.035, 0.32, 1, 20, 12, true);
    g.translate(0, -0.5, 0);
    return g;
  }, []);

  const slots = useMemo<PlumeSlot[]>(
    () =>
      nozzlesFor(trim).map((n) => {
        const mat = new THREE.ShaderMaterial({
          vertexShader: plumeVertex,
          fragmentShader: plumeFragment,
          uniforms: {
            uIntensity: { value: 0 },
            uTime: { value: 0 },
            uCells: { value: 6 },
            uOpen: { value: 0 },
          },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          toneMapped: false,
        });
        const mesh = new THREE.Mesh(coneGeo, mat);
        mesh.frustumCulled = false;
        mesh.visible = false;
        const holder = new THREE.Group();
        holder.position.copy(nozzleVisualPosition(n));
        const jet = new THREE.Vector3(...n.direction).multiplyScalar(-1);
        holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), jet);
        holder.add(mesh);
        return { nozzle: n, holder, mesh, mat, smooth: 0 };
      }),
    [trim, coneGeo],
  );

  useFrame((state, dt) => {
    const s = sim();
    const pa = s?.params.env.ambientPressure ?? 101325;
    // Diamond spacing from the current exit pressure of each nozzle group.
    const cellsFor = (kind: string): number => {
      if (!s || !s.tank) return 6;
      const g = s.params.thrusters.find((x) => x.kind === kind);
      if (!g) return 6;
      const st = nozzlePerformance(
        g.geometry,
        s.params.gas,
        s.tank.pressure,
        s.tank.temperature,
        pa,
      );
      const De = 2 * Math.sqrt((g.geometry.throatArea * g.geometry.areaRatio) / Math.PI);
      const x = firstShockDiamondDistance(st, De, pa) || 0.08;
      return 1 / Math.max(x, 0.02);
    };
    const cells: Record<string, number> = {
      rear: cellsFor('rear'),
      down: cellsFor('down'),
      yaw: cellsFor('yaw'),
    };
    for (const slot of slots) {
      const { k: frac, open } = thrustFraction(s, slot.nozzle.id);
      slot.smooth += (frac - slot.smooth) * Math.min(1, dt * 25);
      const k = slot.smooth;
      const length = 0.3 + 2.6 * Math.sqrt(k);
      slot.mesh.scale.set(0.5 + 0.8 * k, length, 0.5 + 0.8 * k);
      slot.mesh.visible = k > 0.01;
      slot.mat.uniforms.uIntensity!.value = Math.min(1, k * 1.4);
      slot.mat.uniforms.uTime!.value = state.clock.elapsedTime;
      slot.mat.uniforms.uOpen!.value = open ? 1 : 0;
      slot.mat.uniforms.uCells!.value = (cells[kindFor(slot.nozzle.id)] ?? 6) * length;
    }
  });

  return (
    <group>
      {slots.map((s) => (
        <primitive key={s.nozzle.id} object={s.holder} />
      ))}
    </group>
  );
}

/** Condensation cloud in world space, emitted from the car's nozzles. */
export function ExhaustParticles({
  sim,
  trim,
  maxParticles,
  carGroup,
}: {
  sim: () => Sim | null;
  trim: TrimId;
  maxParticles: number;
  carGroup: React.RefObject<THREE.Group | null>;
}) {
  const nozzles = useMemo(() => nozzlesFor(trim), [trim]);
  const particles = useMemo(() => {
    const n = maxParticles;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const life = new Float32Array(n);
    const size = new Float32Array(n);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute float aLife;
        attribute float aSize;
        varying float vLife;
        void main() {
          vLife = aLife;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (600.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vLife;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float a = smoothstep(0.5, 0.05, d) * vLife * 0.42;
          if (a < 0.003) discard;
          gl_FragColor = vec4(vec3(0.93, 0.92, 0.95), a);
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
      size,
      vel: new Float32Array(n * 3),
      age: new Float32Array(n),
      maxAge: new Float32Array(n),
      /** Final size of each puff, m. */
      big: new Float32Array(n),
      next: 0,
    };
  }, [maxParticles]);

  const tmp = useMemo(
    () => ({ p: new THREE.Vector3(), d: new THREE.Vector3(), q: new THREE.Quaternion() }),
    [],
  );
  const acc = useRef<Record<string, number>>({});

  useFrame((_, dt) => {
    const s = sim();
    const car = carGroup.current;
    const t = s?.telemetry;
    // Particles keep moving in real time unless the reader is open (also during scripted captures).
    const step = Math.min(dt, 0.05) * (useApp.getState().articleOpen ? 0 : (s?.timeScale ?? 1));
    let emitted = 0;
    if (car && step > 0) {
      for (const nz of nozzles) {
        const { k } = thrustFraction(s, nz.id);
        if (k <= 0.05) continue;
        const lift = !nz.id.startsWith('R');
        acc.current[nz.id] = (acc.current[nz.id] ?? 0) + (lift ? 160 : 90) * k * step;
        while (acc.current[nz.id]! >= 1 && emitted < 80) {
          acc.current[nz.id]! -= 1;
          emitted++;
          const i = particles.next;
          particles.next = (particles.next + 1) % maxParticles;
          tmp.p.copy(nozzleVisualPosition(nz)).applyMatrix4(car.matrixWorld);
          tmp.d.set(-nz.direction[0], -nz.direction[1], -nz.direction[2]);
          car.getWorldQuaternion(tmp.q);
          tmp.d.applyQuaternion(tmp.q);
          const speed = 14 + 20 * Math.random();
          const v = t?.velocity ?? [0, 0, 0];
          for (let c = 0; c < 3; c++) {
            particles.vel[i * 3 + c] =
              tmp.d.getComponent(c) * speed + (Math.random() - 0.5) * 3 + v[c]! * 0.5;
          }
          const off = 0.5 + Math.random() * 0.6;
          particles.pos[i * 3] = tmp.p.x + tmp.d.x * off;
          particles.pos[i * 3 + 1] = tmp.p.y + tmp.d.y * off;
          particles.pos[i * 3 + 2] = tmp.p.z + tmp.d.z * off;
          particles.age[i] = 0;
          particles.maxAge[i] = lift ? 1.4 + Math.random() * 1.6 : 0.5 + Math.random() * 0.7;
          particles.big[i] = lift ? 2.5 + Math.random() * 2.5 : 1.2 + Math.random() * 0.8;
        }
      }
    }
    // Drag slows the cloud; it grows and fades.
    for (let i = 0; i < maxParticles; i++) {
      const ma = particles.maxAge[i]!;
      if (ma <= 0) continue;
      const a = (particles.age[i] = particles.age[i]! + step);
      if (a >= ma) {
        particles.maxAge[i] = 0;
        particles.life[i] = 0;
        continue;
      }
      // Puffs that reach the ground spread out sideways and billow up.
      if (particles.pos[i * 3 + 1]! < 0.4 && particles.vel[i * 3 + 1]! < 0) {
        const down = -particles.vel[i * 3 + 1]!;
        const ang = Math.random() * Math.PI * 2;
        particles.vel[i * 3] = particles.vel[i * 3]! * 0.4 + Math.cos(ang) * down * 0.6;
        particles.vel[i * 3 + 2] = particles.vel[i * 3 + 2]! * 0.4 + Math.sin(ang) * down * 0.6;
        particles.vel[i * 3 + 1] = down * 0.08;
      }
      const drag = Math.exp(-step * 2.2);
      particles.vel[i * 3] = particles.vel[i * 3]! * drag;
      particles.vel[i * 3 + 1] = particles.vel[i * 3 + 1]! * drag + 0.5 * step;
      particles.vel[i * 3 + 2] = particles.vel[i * 3 + 2]! * drag;
      particles.pos[i * 3] = particles.pos[i * 3]! + particles.vel[i * 3]! * step;
      particles.pos[i * 3 + 1] = Math.max(
        0.05,
        particles.pos[i * 3 + 1]! + particles.vel[i * 3 + 1]! * step,
      );
      particles.pos[i * 3 + 2] = particles.pos[i * 3 + 2]! + particles.vel[i * 3 + 2]! * step;
      const r = a / ma;
      particles.life[i] = (1 - r) * Math.min(1, r * 6);
      particles.size[i] = 0.25 + particles.big[i]! * Math.sqrt(r);
    }
    const g = particles.pts.geometry;
    (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.aLife as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
  });

  return <primitive object={particles.pts} />;
}
