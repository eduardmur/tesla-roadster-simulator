/** The curl ramp: concrete slab, painted lines, red LED edges and a steel truss tower. */
import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RAMP, curlNormal, curlPoint, type CurlSpec } from '../../sim/track';

const SEGMENTS = 120;

/** Solid curl: riding face, underside and both sides. */
function slabGeometry(c: CurlSpec): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const half = c.width / 2;
  const at = (side: number, outer: boolean, t: number) => {
    const p = curlPoint(c, t, c.x + side);
    if (outer) {
      const n = curlNormal(t);
      p[1] -= n[1] * c.thickness;
      p[2] -= n[2] * c.thickness;
    }
    return p;
  };
  const faces: {
    a: (t: number) => number[];
    b: (t: number) => number[];
    n: (t: number) => number[];
  }[] = [
    { a: (t) => at(half, false, t), b: (t) => at(-half, false, t), n: (t) => curlNormal(t) },
    {
      a: (t) => at(-half, true, t),
      b: (t) => at(half, true, t),
      n: (t) => curlNormal(t).map((v) => -v),
    },
    { a: (t) => at(half, true, t), b: (t) => at(half, false, t), n: () => [1, 0, 0] },
    { a: (t) => at(-half, false, t), b: (t) => at(-half, true, t), n: () => [-1, 0, 0] },
  ];
  for (const f of faces) {
    let prev: [number, number] | null = null;
    for (let i = 0; i <= SEGMENTS; i++) {
      const t = (i / SEGMENTS) * c.arc;
      const n = f.n(t);
      const s = (t * c.radius) / 4;
      pos.push(...f.a(t));
      nor.push(...n);
      uv.push(0, s);
      pos.push(...f.b(t));
      nor.push(...n);
      uv.push(1, s);
      const ia = pos.length / 3 - 2;
      const ib = ia + 1;
      if (prev) idx.push(prev[0], prev[1], ia, prev[1], ib, ia);
      prev = [ia, ib];
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** A thin strip lying on the riding surface at lateral offset x (for painted lines). */
function stripGeometry(
  c: CurlSpec,
  x: number,
  width: number,
  lift = 0.006,
  dash = 0,
): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = (i / SEGMENTS) * c.arc;
    const n = curlNormal(t);
    for (const s of [-1, 1]) {
      const p = curlPoint(c, t, c.x + x + (s * width) / 2);
      pos.push(p[0], p[1] + n[1] * lift, p[2] + n[2] * lift);
    }
    if (i < SEGMENTS && (!dash || Math.floor(i / dash) % 2 === 0)) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  parts.push(g);
  return mergeGeometries(parts)!;
}

/** LED tube following the slab edge. */
function edgeTubeGeometry(c: CurlSpec, x: number): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = (i / SEGMENTS) * c.arc;
    const p = curlPoint(c, t, c.x + x);
    const n = curlNormal(t);
    pts.push(new THREE.Vector3(p[0], p[1] + n[1] * 0.04, p[2] + n[2] * 0.04));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), SEGMENTS * 2, 0.035, 6, false);
}

/** Steel lattice tower behind the ramp on one side, legs to the ground. */
function trussGeometry(c: CurlSpec): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const beam = (a: THREE.Vector3, b: THREE.Vector3, r: number) => {
    const len = a.distanceTo(b);
    if (len < 0.01) return;
    const g = new THREE.CylinderGeometry(r, r, len, 6, 1);
    g.translate(0, len / 2, 0);
    g.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        b.clone().sub(a).normalize(),
      ),
    );
    g.translate(a.x, a.y, a.z);
    parts.push(g);
  };
  const side = -(c.width / 2 + 0.7);
  const rail = (depth: number, x: number, t: number) => {
    const p = curlPoint(c, t, x);
    const n = curlNormal(t);
    const d = c.thickness + depth;
    return new THREE.Vector3(p[0], p[1] - n[1] * d, p[2] - n[2] * d);
  };
  const steps = 34;
  for (let i = 0; i < steps; i++) {
    const t0 = (i / steps) * c.arc;
    const t1 = ((i + 1) / steps) * c.arc;
    for (const x of [side, side - 1.6]) {
      beam(rail(0.3, x, t0), rail(0.3, x, t1), 0.09);
      beam(rail(2.0, x, t0), rail(2.0, x, t1), 0.09);
      beam(rail(0.3, x, t0), rail(2.0, x, t1), 0.04);
    }
    beam(rail(0.3, side, t0), rail(0.3, side - 1.6, t0), 0.04);
    beam(rail(2.0, side, t0), rail(2.0, side - 1.6, t1), 0.04);
    // Cross members under the slab to the other side.
    if (i % 3 === 0) beam(rail(0.3, side, t0), rail(0.3, -side, t0), 0.05);
  }
  // Legs from the lattice to the ground.
  for (let i = 4; i <= steps; i += 3) {
    const t = (i / steps) * c.arc;
    for (const x of [side, side - 1.6]) {
      const top = rail(2.0, x, t);
      if (top.y > 1) beam(new THREE.Vector3(top.x, 0, top.z), top, 0.12);
    }
    const far = rail(0.3, -side, t);
    if (far.y > 1 && i % 6 === 1) beam(new THREE.Vector3(far.x, 0, far.z), far, 0.08);
  }
  return mergeGeometries(parts.map((g) => g.toNonIndexed()))!;
}

export function Ramp() {
  const geo = useMemo(
    () => ({
      slab: slabGeometry(RAMP),
      centre: stripGeometry(RAMP, 0, 0.12, 0.006, 6),
      lineL: stripGeometry(RAMP, RAMP.width / 2 - 0.35, 0.1),
      lineR: stripGeometry(RAMP, -RAMP.width / 2 + 0.35, 0.1),
      ledL: edgeTubeGeometry(RAMP, RAMP.width / 2 - 0.02),
      ledR: edgeTubeGeometry(RAMP, -RAMP.width / 2 + 0.02),
      truss: trussGeometry(RAMP),
    }),
    [],
  );
  const concrete = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: '#8f9091', roughness: 0.9 });
    m.onBeforeCompile = (shader) => {
      // Faint panel joints and blotches, from the strip's arc-length UV.
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vRampUv;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvRampUv = uv;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec2 vRampUv;
float rh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
float j = smoothstep(0.0, 0.015, abs(fract(vRampUv.y) - 0.5) - 0.48);
vec2 q = vRampUv * vec2(4.0, 2.0);
vec2 i0 = floor(q), f0 = fract(q);
vec2 u0 = f0 * f0 * (3.0 - 2.0 * f0);
float blot = mix(mix(rh(i0), rh(i0 + vec2(1, 0)), u0.x), mix(rh(i0 + vec2(0, 1)), rh(i0 + vec2(1, 1)), u0.x), u0.y);
diffuseColor.rgb *= (0.86 + 0.1 * blot) * (1.0 - 0.3 * j);`,
        );
    };
    return m;
  }, []);
  return (
    <group>
      <mesh geometry={geo.slab} material={concrete} castShadow receiveShadow />
      <mesh geometry={geo.centre}>
        <meshStandardMaterial color="#e8e8e8" roughness={0.7} />
      </mesh>
      <mesh geometry={geo.lineL}>
        <meshStandardMaterial color="#e8e8e8" roughness={0.7} />
      </mesh>
      <mesh geometry={geo.lineR}>
        <meshStandardMaterial color="#e8e8e8" roughness={0.7} />
      </mesh>
      <mesh geometry={geo.ledL}>
        <meshBasicMaterial color={[3, 0.25, 0.2]} toneMapped={false} />
      </mesh>
      <mesh geometry={geo.ledR}>
        <meshBasicMaterial color={[3, 0.25, 0.2]} toneMapped={false} />
      </mesh>
      <mesh geometry={geo.truss} castShadow>
        <meshStandardMaterial color="#5b6068" roughness={0.45} metalness={0.8} />
      </mesh>
    </group>
  );
}
