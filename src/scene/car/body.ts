/**
 * Lofted car body: a smooth cross-section swept along the car, with fenders over the wheels,
 * a dark glass canopy and a dark lower band. Original procedural shape (no external models).
 * Body frame: +X left, +Y up, +Z forward, origin at the centre of mass.
 */
import * as THREE from 'three';

type Key = [z: number, v: number];

/**
 * Smooth (C1) interpolation through (z, value) keys, z descending (nose → tail): a cubic
 * Hermite spline with Catmull-Rom tangents, so the surface has no flat "terraces" at the keys.
 */
function curve(keys: Key[], z: number): number {
  const n = keys.length;
  if (z >= keys[0]![0]) return keys[0]![1];
  if (z <= keys[n - 1]![0]) return keys[n - 1]![1];
  const slope = (i: number) => {
    const a = keys[Math.max(i - 1, 0)]!;
    const b = keys[Math.min(i + 1, n - 1)]!;
    return (b[1] - a[1]) / (b[0] - a[0]);
  };
  for (let i = 0; i < n - 1; i++) {
    const [z0, v0] = keys[i]!;
    const [z1, v1] = keys[i + 1]!;
    if (z <= z0 && z >= z1) {
      const h = z1 - z0;
      const t = (z - z0) / h;
      const t2 = t * t;
      const t3 = t2 * t;
      return (
        (2 * t3 - 3 * t2 + 1) * v0 +
        (t3 - 2 * t2 + t) * h * slope(i) +
        (-2 * t3 + 3 * t2) * v1 +
        (t3 - t2) * h * slope(i + 1)
      );
    }
  }
  return keys[n - 1]![1];
}

/** Smooth maximum (no crease where the two inputs cross). */
const smax = (a: number, b: number, k = 0.04) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + (h * h * k) / 4;
};

/** 1 inside |z − c| < 0.7·r, easing to 0 at r. */
function bump(z: number, c: number, r: number): number {
  const d = Math.abs(z - c) / r;
  if (d >= 1) return 0;
  if (d <= 0.7) return 1;
  const t = (1 - d) / 0.3;
  return t * t * (3 - 2 * t);
}

export const FRONT_AXLE = 1.36;
export const REAR_AXLE = -1.4;
const NOSE = 2.17;
const TAIL = -2.17;

const BOTTOM: Key[] = [
  [NOSE, -0.2],
  [2.0, -0.3],
  [1.6, -0.33],
  [-1.7, -0.33],
  [-2.05, -0.2],
  [TAIL, -0.12],
];
const SHOULDER_Y: Key[] = [
  [NOSE, -0.08],
  [2.0, 0.06],
  [1.6, 0.24],
  [FRONT_AXLE, 0.3],
  [1.0, 0.25],
  [0.3, 0.2],
  [-0.6, 0.26],
  [REAR_AXLE, 0.36],
  [-1.9, 0.3],
  [TAIL, 0.15],
];
const SHOULDER_W: Key[] = [
  [NOSE, 0.6],
  [2.0, 0.86],
  [1.6, 0.97],
  [FRONT_AXLE, 0.99],
  [0.6, 0.95],
  [-0.4, 0.96],
  [REAR_AXLE, 1.0],
  [-1.9, 0.95],
  [TAIL, 0.84],
];
const TOP_Y: Key[] = [
  [NOSE, -0.07],
  [2.0, 0.04],
  [1.5, 0.1],
  [0.95, 0.16],
  [0.5, 0.4],
  [0.0, 0.6],
  [-0.5, 0.64],
  [-1.0, 0.54],
  [-1.6, 0.32],
  [-2.0, 0.22],
  [TAIL, 0.15],
];
const TOP_W: Key[] = [
  [NOSE, 0.38],
  [1.5, 0.6],
  [0.95, 0.66],
  [0.5, 0.58],
  [0.0, 0.55],
  [-0.6, 0.52],
  [-1.5, 0.6],
  [TAIL, 0.7],
];

export interface Station {
  yb: number;
  ys: number;
  w: number;
  wl: number;
  yt: number;
  wt: number;
}

export function station(z: number): Station {
  const w = curve(SHOULDER_W, z);
  let wl = 0.92 - 0.27 * bump(z, FRONT_AXLE, 0.5) - 0.27 * bump(z, REAR_AXLE, 0.5);
  wl = Math.min(wl, w - 0.05);
  return {
    yb: curve(BOTTOM, z),
    ys: curve(SHOULDER_Y, z),
    w,
    wl,
    yt: curve(TOP_Y, z),
    wt: Math.min(curve(TOP_W, z), w - 0.08),
  };
}

const RING = 56;

/** Closed cross-section at a station, sampled into RING points. */
function crossSection(s: Station): THREE.Vector2[] {
  const half: [number, number][] = [
    [0, s.yb],
    [s.wl * 0.9, s.yb],
    [s.wl, s.yb + 0.06],
    [s.wl + (s.w - s.wl) * 0.75, s.ys - 0.12],
    [s.w, s.ys],
    [s.w - 0.06, s.ys + 0.05],
    [s.wt, smax(s.yt - 0.05, s.ys - 0.12)],
    [s.wt * 0.55, s.yt],
    [0, s.yt],
  ];
  const pts = [
    ...half,
    ...half
      .slice(1, -1)
      .reverse()
      .map(([x, y]) => [-x, y] as [number, number]),
  ];
  const c = new THREE.CatmullRomCurve3(
    pts.map(([x, y]) => new THREE.Vector3(x, y, 0)),
    true,
    'centripetal',
  );
  return c
    .getSpacedPoints(RING)
    .slice(0, RING)
    .map((p) => new THREE.Vector2(p.x, p.y));
}

/** Paint with a per-pixel glass canopy and dark lower band (see bodyGeometry's `profile`). */
export function bodyMaterial(): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    color: '#eceef0',
    roughness: 0.26,
    metalness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.6,
  });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute vec3 profile;\nvarying vec3 vProfile;\nvarying vec3 vLocal;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvProfile = profile;\nvLocal = position;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vProfile;
varying vec3 vLocal;
float edge(float v, float at) { float w = fwidth(v) * 1.5; return smoothstep(at - w, at + w, v); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float inCabin = edge(vLocal.z, -1.8) * (1.0 - edge(vLocal.z, 1.0));
float glass = inCabin * edge(vLocal.y, vProfile.x + 0.07) * (1.0 - edge(abs(vLocal.x), vProfile.y - 0.075));
float trim = 1.0 - edge(vLocal.y, vProfile.z + 0.07);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.006, 0.007, 0.009), max(trim * 0.92, glass));`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.14, glass);`,
      );
  };
  return m;
}

/**
 * The body as one mesh. Each vertex also carries its station's shoulder height, shoulder
 * width and floor height, so the shader can draw crisp glass and trim edges per pixel.
 */
export function bodyGeometry(stations = 160): THREE.BufferGeometry {
  const pos: number[] = [];
  const prof: number[] = [];
  const idx: number[] = [];
  const rings: number[] = [];
  for (let i = 0; i <= stations; i++) {
    const z = NOSE + ((TAIL - NOSE) * i) / stations;
    const s = station(z);
    const ring = crossSection(s);
    rings.push(pos.length / 3);
    for (const p of ring) {
      pos.push(p.x, p.y, z);
      prof.push(s.ys, s.w, s.yb);
    }
  }
  for (let i = 0; i < stations; i++) {
    const a = rings[i]!;
    const b = rings[i + 1]!;
    for (let j = 0; j < RING; j++) {
      const j2 = (j + 1) % RING;
      idx.push(a + j, b + j, a + j2, a + j2, b + j, b + j2);
    }
  }
  // Caps: fan to the centre of the end rings.
  for (const [ring, flip] of [
    // The nose cap faces +Z and the tail cap −Z; the ring winds counter-clockwise seen from +Z.
    [rings[0]!, true],
    [rings[stations]!, false],
  ] as const) {
    let cx = 0;
    let cy = 0;
    const cz = pos[ring * 3 + 2]!;
    for (let j = 0; j < RING; j++) {
      cx += pos[(ring + j) * 3]!;
      cy += pos[(ring + j) * 3 + 1]!;
    }
    const center = pos.length / 3;
    pos.push(cx / RING, cy / RING, cz);
    prof.push(prof[ring * 3]!, prof[ring * 3 + 1]!, prof[ring * 3 + 2]!);
    for (let j = 0; j < RING; j++) {
      const j2 = (j + 1) % RING;
      if (flip) idx.push(center, ring + j, ring + j2);
      else idx.push(center, ring + j2, ring + j);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('profile', new THREE.Float32BufferAttribute(prof, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
