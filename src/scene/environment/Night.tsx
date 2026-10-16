/**
 * Night test site: black sky, dark asphalt with the runway and pools of red lamp light,
 * red light panels at the ramp's foot, blue searchlights and a few drones overhead.
 * Everything is procedural; no textures or HDRIs are downloaded.
 */
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RAMP, RUNWAY } from '../../sim/track';

export const NIGHT = '#030406';
const f = (n: number) => n.toFixed(3);

export function NightSky() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
            vec4 p = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
            gl_Position = p.xyww;
          }`,
        fragmentShader: /* glsl */ `
          varying vec3 vDir;
          float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
          void main() {
            vec3 d = normalize(vDir);
            float h = clamp(d.y, 0.0, 1.0);
            // Linear values (post-processing converts to sRGB): a near-black night.
            vec3 col = mix(vec3(0.0022, 0.0026, 0.0038), vec3(0.0003, 0.0003, 0.0005), smoothstep(0.0, 0.35, h));
            float st = step(0.9993, hash(floor(d * 420.0))) * smoothstep(0.05, 0.5, h);
            col += vec3(st * 0.25);
            gl_FragColor = vec4(col, 1.0);
          }`,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    [],
  );
  return (
    <mesh material={material} renderOrder={-100} frustumCulled={false} scale={2000}>
      <sphereGeometry args={[1, 32, 16]} />
    </mesh>
  );
}

export function Ground() {
  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.55,
      metalness: 0.05,
    });
    const lampX = RUNWAY.width / 2 + 1;
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;')
        .replace(
          '#include <worldpos_vertex>',
          '#include <worldpos_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          /* glsl */ `#include <common>
varying vec3 vWorldPos;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), u.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), u.x), u.y);
}
float lineAt(float v, float at, float w) { return 1.0 - smoothstep(w * 0.5, w * 0.5 + 0.02, abs(v - at)); }`,
        )
        .replace(
          '#include <color_fragment>',
          /* glsl */ `#include <color_fragment>
vec2 p = vWorldPos.xz;
float n = n2(p * 0.7) * 0.5 + n2(p * 3.1) * 0.3 + n2(p * 0.06) * 0.2;
vec3 col = vec3(0.032, 0.033, 0.036) * (0.8 + 0.4 * n);
float onRunway = step(${f(RUNWAY.start)}, p.y) * step(p.y, ${f(RUNWAY.end + 1.0)});
float edges = lineAt(abs(p.x - ${f(RUNWAY.x)}), ${f(RUNWAY.width / 2)}, 0.14);
float centre = lineAt(p.x, ${f(RUNWAY.x)}, 0.14);
col = mix(col, vec3(0.75), onRunway * clamp(edges + centre, 0.0, 1.0));
diffuseColor.rgb = col;`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          /* glsl */ `#include <emissivemap_fragment>
// Pools of red light from the runway lamps (cheaper than real lights).
{
  float sp = ${f(RUNWAY.lampSpacing)};
  float lz = clamp(floor(vWorldPos.z / sp + 0.5) * sp, ${f(RUNWAY.start)}, ${f(RUNWAY.end - 4.0)});
  float side = sign(vWorldPos.x - ${f(RUNWAY.x)});
  vec2 lamp = vec2(${f(RUNWAY.x)} + side * ${f(lampX)}, lz);
  vec2 d = vWorldPos.xz - lamp;
  d.x *= side;
  // Fan of light thrown away from the runway.
  float fan = exp(-dot(vec2(d.x - 1.6, d.y * 1.4), vec2(d.x - 1.6, d.y * 1.4)) / 3.5) * step(-0.4, d.x);
  totalEmissiveRadiance += vec3(0.9, 0.06, 0.04) * fan * 0.9;
  // Soft white wash at the foot of the ramp.
  vec2 r = vWorldPos.xz - vec2(${f(RAMP.x)}, ${f(RAMP.z0 - 6)});
  totalEmissiveRadiance += vec3(0.05) * exp(-dot(r, r) / 120.0);
}`,
        );
    };
    return mat;
  }, []);
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow material={material}>
      <planeGeometry args={[3000, 3000, 1, 1]} />
    </mesh>
  );
}

/** Small red lamp housings along both runway edges (glowing, so bloom picks them up). */
export function RunwayLamps() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const positions = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let z = RUNWAY.start; z <= RUNWAY.end - 4; z += RUNWAY.lampSpacing) {
      for (const s of [-1, 1]) out.push([RUNWAY.x + s * (RUNWAY.width / 2 + 1), 0.12, z]);
    }
    return out;
  }, []);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    positions.forEach((p, i) => ref.current?.setMatrixAt(i, m.makeTranslation(...p)));
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  }, [positions]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, positions.length]}>
      <boxGeometry args={[0.35, 0.22, 0.35]} />
      <meshBasicMaterial color={[2.5, 0.15, 0.1]} toneMapped={false} />
    </instancedMesh>
  );
}

/** Vertical red LED bars flanking the foot of the ramp, with a red glow on the ground. */
export function LightPanels() {
  const bars = useMemo(() => {
    const out: [number, number, number][] = [];
    for (const s of [-1, 1]) {
      for (let k = 0; k < 4; k++)
        out.push([RAMP.x + s * (RAMP.width / 2 + 2.2 + k * 0.55), 0, RAMP.z0 - 1.2 - k * 0.7]);
    }
    return out;
  }, []);
  return (
    <group>
      {bars.map((p, i) => (
        <mesh key={i} position={[p[0], 2.4 + (i % 4) * 0.3, p[2]]}>
          <boxGeometry args={[0.05, 4.8 + (i % 4) * 0.6, 0.05]} />
          <meshBasicMaterial color={[2.2, 0.12, 0.08]} toneMapped={false} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <pointLight
          key={s}
          position={[RAMP.x + s * (RAMP.width / 2 + 3.2), 3, RAMP.z0 - 4]}
          color="#ff2a18"
          intensity={35}
          distance={18}
          decay={2}
        />
      ))}
    </group>
  );
}

/** Blue searchlight beams sweeping slowly near the ramp. */
export function Searchlights({ reducedMotion }: { reducedMotion: boolean }) {
  const beams = useRef<(THREE.Group | null)[]>([]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          varying float vH;
          void main() { vH = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          varying float vH;
          void main() { float a = 0.13 * pow(vH, 1.6); gl_FragColor = vec4(vec3(0.35, 0.55, 1.0) * a, a); }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
      }),
    [],
  );
  const setup = useMemo(
    () => [
      { x: -14, z: -8, tilt: 0.25, phase: 0 },
      { x: -11, z: -14, tilt: 0.18, phase: 1.7 },
      { x: 13, z: -10, tilt: -0.22, phase: 3.1 },
    ],
    [],
  );
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(2.2, 0.15, 60, 24, 1, true);
    g.translate(0, 30, 0);
    return g;
  }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    beams.current.forEach((b, i) => {
      if (!b) return;
      const s = setup[i]!;
      b.rotation.z = s.tilt + (reducedMotion ? 0 : Math.sin(t * 0.15 + s.phase) * 0.12);
      b.rotation.x = -0.15 + (reducedMotion ? 0 : Math.cos(t * 0.11 + s.phase) * 0.06);
    });
  });
  return (
    <group>
      {setup.map((s, i) => (
        <group
          key={i}
          position={[s.x, 0, s.z]}
          ref={(el) => {
            beams.current[i] = el;
          }}
        >
          <mesh geometry={geo} material={material} />
        </group>
      ))}
    </group>
  );
}

/** A few drones holding position over the site, blinking gently. */
export function Drones({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const spots = useMemo(
    () => [
      [-18, 34, 6],
      [-9, 40, -20],
      [16, 31, -6],
      [22, 44, 18],
      [-26, 27, -32],
    ],
    [],
  );
  useFrame(({ clock }) => {
    if (!ref.current || reducedMotion) return;
    ref.current.children.forEach((c, i) => {
      c.position.y = spots[i]![1]! + Math.sin(clock.elapsedTime * 0.4 + i) * 0.6;
    });
  });
  return (
    <group ref={ref}>
      {spots.map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <sphereGeometry args={[0.18, 8, 8]} />
          <meshBasicMaterial color={[3, 3, 3]} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
