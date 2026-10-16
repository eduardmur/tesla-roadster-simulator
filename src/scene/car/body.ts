/**
 * Lofted car body: a faceted cross-section (straight planes with small fillets, so the creases
 * stay crisp) swept along the car. A long, low glass canopy, thin side windows, a black sill
 * that rises behind the rear wheels and cut-out wheel arches are drawn per pixel in the shader.
 * Original procedural shape (no external models, no logos).
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

/** Piecewise-linear through the keys: plan-view chamfers stay straight, with crisp facet lines. */
function linear(keys: Key[], z: number): number {
  const n = keys.length;
  if (z >= keys[0]![0]) return keys[0]![1];
  for (let i = 0; i < n - 1; i++) {
    const [z0, v0] = keys[i]!;
    const [z1, v1] = keys[i + 1]!;
    if (z <= z0 && z >= z1) return v0 + ((v1 - v0) * (z - z0)) / (z1 - z0);
  }
  return keys[n - 1]![1];
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const FRONT_AXLE = 1.36;
export const REAR_AXLE = -1.4;
/** Wheel centre height at rest (body frame) and the radius of the cut-out arches. */
export const WHEEL_Y = -0.11;
export const ARCH_RADIUS = 0.43;
const NOSE = 2.17;
const TAIL = -2.17;

/** Floor (skirt) height. */
const BOTTOM: Key[] = [
  [NOSE, -0.24],
  [2.0, -0.32],
  [1.7, -0.35],
  [-1.75, -0.35],
  [-2.0, -0.29],
  [TAIL, -0.24],
];
/** Top of the black sill: the crease between the lower and upper side. */
const ROCKER_Y: Key[] = [
  [NOSE, -0.14],
  [1.6, -0.12],
  [-1.6, -0.1],
  [TAIL, -0.08],
];
/** Shoulder crease: over the front wheel, down along the door, up over the rear haunch. */
const SHOULDER_Y: Key[] = [
  [NOSE, -0.02],
  [1.9, 0.19],
  [FRONT_AXLE, 0.335],
  [0.9, 0.3],
  [0.2, 0.26],
  [-0.7, 0.3],
  [REAR_AXLE, 0.38],
  [-1.9, 0.37],
  [TAIL, 0.38],
];
/** Half-width at the shoulder (plan view: chamfered nose and tail). */
const SHOULDER_W: Key[] = [
  [NOSE, 0.66],
  [1.78, 0.95],
  [FRONT_AXLE, 0.99],
  [0.4, 0.97],
  [REAR_AXLE, 1.01],
  [-1.85, 1.0],
  [TAIL, 0.9],
];
/** Centreline height: low nose, very raked windshield, long fastback to a tall tail. */
const TOP_Y: Key[] = [
  [NOSE, 0.05],
  [1.9, 0.21],
  [1.6, 0.3],
  [1.36, 0.35],
  [1.08, 0.41],
  [0.5, 0.57],
  [0.0, 0.62],
  [-0.5, 0.63],
  [-1.0, 0.59],
  [-1.5, 0.51],
  [-1.85, 0.46],
  [TAIL, 0.43],
];
/** Half-width of the top (between the roof rails / fender tops). */
const TOP_W: Key[] = [
  [NOSE, 0.5],
  [1.8, 0.7],
  [1.08, 0.8],
  [0.3, 0.74],
  [-0.5, 0.64],
  [-1.2, 0.54],
  [-1.82, 0.47],
  [TAIL, 0.8],
];
/** Height of the side windows (zero where there are none). */
const SIDE_GLASS: Key[] = [
  [1.1, 0],
  [0.8, 0.13],
  [0.3, 0.2],
  [-0.3, 0.19],
  [-0.75, 0.11],
  [-1.1, 0],
];

export interface Station {
  /** Floor height. */
  yb: number;
  /** Floor half-width. */
  wl: number;
  yr: number;
  wr: number;
  /** Shoulder crease. */
  ys: number;
  w: number;
  /** Base of the side window (beltline). */
  ybelt: number;
  wbelt: number;
  /** Roof rail (top edge of the side window / edge of the top). */
  yrail: number;
  wt: number;
  /** Centreline height. */
  yt: number;
}

export function station(z: number): Station {
  const w = linear(SHOULDER_W, z);
  const yt = curve(TOP_Y, z);
  const wt = Math.min(linear(TOP_W, z), w - 0.12);
  const hg = z < 1.1 && z > -1.1 ? Math.max(0, curve(SIDE_GLASS, z)) : 0;
  const ys = curve(SHOULDER_Y, z);
  // Over the hood the fender tops sit just above the centre: a shallow valley.
  const hood = smooth(1.0, 1.45, z);
  const yrail = Math.max(yt - 0.035 + 0.05 * hood, ys + 0.04);
  const ybelt = Math.max(yrail - hg, ys + 0.04);
  const wbelt = Math.min(wt + 0.65 * (yrail - ybelt) + 0.0001, w - 0.08);
  const yb = curve(BOTTOM, z);
  return {
    yb,
    wl: Math.min(0.9, w - 0.1),
    yr: Math.max(curve(ROCKER_Y, z), yb + 0.08),
    wr: w - 0.05,
    ys,
    w,
    ybelt,
    wbelt,
    yrail,
    wt,
    yt,
  };
}

/** Corner points of the half cross-section, bottom centre to top centre (u = 0 … 8). */
function corners(s: Station): [number, number][] {
  return [
    [0, s.yb], // 0 floor centre
    [s.wl - 0.06, s.yb], // 1 floor edge
    [s.wl, s.yb + 0.05], // 2 sill corner
    [s.wr, s.yr], // 3 top of the black sill
    [s.w, s.ys], // 4 shoulder crease
    [s.wbelt, s.ybelt], // 5 beltline
    [s.wt, s.yrail], // 6 roof rail
    [s.wt - 0.04, s.yt - 0.008], // 7 edge of the top
    [0, s.yt], // 8 top centre
  ];
}
/** Fillet radius at each corner (m) and samples per fillet / per edge. */
const FILLET = [0, 0.03, 0.03, 0.025, 0.012, 0.02, 0.015, 0.03, 0];
const EDGE_SAMPLES = [5, 1, 4, 4, 3, 3, 1, 7];
const FILLET_SAMPLES = 3;

/** Sample the half cross-section; returns points and the u coordinate of each. */
function halfSection(s: Station): { x: number; y: number; u: number }[] {
  const P = corners(s);
  const out: { x: number; y: number; u: number }[] = [];
  const len = (a: [number, number], b: [number, number]) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  // Fillet start/end distance along the incoming/outgoing edge for each corner.
  const d = P.map((p, i) => {
    if (i === 0 || i === P.length - 1) return 0;
    return Math.min(FILLET[i]!, 0.4 * len(P[i - 1]!, p), 0.4 * len(p, P[i + 1]!));
  });
  const along = (i: number, j: number, dist: number): [number, number] => {
    const a = P[i]!;
    const b = P[j]!;
    const L = len(a, b);
    if (L < 1e-6) return [a[0], a[1]];
    return [a[0] + ((b[0] - a[0]) * dist) / L, a[1] + ((b[1] - a[1]) * dist) / L];
  };
  for (let i = 0; i < P.length; i++) {
    // Corner (filleted with a quadratic Bezier).
    if (i === 0 || i === P.length - 1) out.push({ x: P[i]![0], y: P[i]![1], u: i });
    else {
      const Lin = len(P[i - 1]!, P[i]!);
      const Lout = len(P[i]!, P[i + 1]!);
      const S = along(i, i - 1, d[i]!);
      const E = along(i, i + 1, d[i]!);
      const u0 = i - (Lin > 1e-6 ? d[i]! / Lin : 0);
      const u1 = i + (Lout > 1e-6 ? d[i]! / Lout : 0);
      for (let k = 0; k < FILLET_SAMPLES; k++) {
        const t = k / (FILLET_SAMPLES - 1);
        const a = (1 - t) * (1 - t);
        const b = 2 * (1 - t) * t;
        const c = t * t;
        out.push({
          x: a * S[0] + b * P[i]![0] + c * E[0],
          y: a * S[1] + b * P[i]![1] + c * E[1],
          u: u0 + (u1 - u0) * t,
        });
      }
    }
    if (i === P.length - 1) break;
    // Straight edge to the next corner.
    const L = len(P[i]!, P[i + 1]!);
    const from = d[i]!;
    const to = L - d[i + 1]!;
    const n = EDGE_SAMPLES[i]!;
    for (let k = 1; k <= n; k++) {
      const dist = from + ((to - from) * k) / (n + 1);
      const [x, y] = along(i, i + 1, Math.max(0, dist));
      out.push({ x, y, u: i + (L > 1e-6 ? dist / L : k / (n + 1)) });
    }
  }
  return out;
}

const SAMPLE = halfSection(station(0));
/** Ring size: the half section mirrored, without repeating the two centre points. */
const RING = SAMPLE.length * 2 - 2;

/** Closed cross-section at a station (counter-clockwise seen from +Z), with u per point. */
function crossSection(s: Station): { x: number; y: number; u: number }[] {
  const half = halfSection(s);
  // Left side (+X) bottom → top, then the right side (−X) top → bottom.
  const right = half
    .slice(1, -1)
    .reverse()
    .map((p) => ({ x: -p.x, y: p.y, u: p.u }));
  return [...half, ...right];
}

/** Paint, bronze glass, satin-black trim, seams and cut-out arches, all per pixel. */
export function bodyMaterial(): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    color: '#eceef0',
    roughness: 0.24,
    metalness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.6,
  });
  const f = (n: number) => n.toFixed(3);
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float section;\nvarying float vU;\nvarying vec3 vLocal;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvU = section;\nvLocal = position;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
varying float vU;
varying vec3 vLocal;
float edge(float v, float at) { float w = fwidth(v) * 1.2 + 1e-5; return smoothstep(at - w, at + w, v); }
float band(float v, float a, float b) { return edge(v, a) * (1.0 - edge(v, b)); }
float seam(float v, float at, float halfWidth) { float w = fwidth(v) + 1e-5; return 1.0 - smoothstep(halfWidth, halfWidth + w, abs(v - at)); }`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        /* glsl */ `#include <clipping_planes_fragment>
// Wheel arches: cut the sides around each wheel (a dark wheelhouse sits behind the hole).
{
  float ax = abs(vLocal.x);
  vec2 front = vec2(vLocal.y - ${f(WHEEL_Y)}, vLocal.z - ${f(FRONT_AXLE)});
  vec2 rear = vec2(vLocal.y - ${f(WHEEL_Y)}, vLocal.z - ${f(REAR_AXLE)});
  float r = ${f(ARCH_RADIUS)};
  if (ax > 0.64 && vU < 4.4 && (dot(front, front) < r * r || dot(rear, rear) < r * r)) discard;
}`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
float ax = abs(vLocal.x);
float z = vLocal.z;
// Black sill below the rocker crease, rising behind the rear wheel toward the shoulder.
float sillTop = 3.0 + clamp((-1.66 - z) * 3.2, 0.0, 0.88);
float trim = 1.0 - edge(vU, sillTop);
// Rear face (tail cap, section 9): a black light band along the top, a black lower section
// and narrow black corners framing a wide body-colour panel.
float cap = edge(vU, 8.5);
float capBlack = max(max(edge(vLocal.y, 0.33), 1.0 - edge(vLocal.y, 0.055)), edge(ax, 0.8));
trim = max(trim, cap * capBlack);
// Side windows: the whole window band between the beltline and the roof rail.
float side = band(vU, 5.03, 5.97);
side *= 1.0 - seam(z, 0.12, 0.006);
// Canopy: one long glass top; V-shaped front edge, chamfered rear corners, a few seams.
float zFront = 1.5 - max(0.0, ax - 0.34) * 0.95;
float zRear = -1.82 + max(0.0, ax - 0.3) * 0.8;
float canopy = edge(vU, 7.05) * band(z, zRear, zFront);
float lines = seam(z, 0.29, 0.005) + seam(z, -0.55, 0.005);
lines += (seam(ax, 0.13, 0.004)) * band(z, -0.55, 0.29);
canopy *= 1.0 - clamp(lines, 0.0, 1.0) * 0.85;
float glass = max(side, canopy);
// Door cut lines on the side.
float doors = (seam(z, 1.0, 0.004) + seam(z, -0.64, 0.004)) * band(vU, 2.2, 4.85);
vGlass = glass;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.012, 0.013, 0.015), max(trim, doors * 0.9));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.11, 0.066, 0.03), glass);`,
      )
      .replace('varying vec3 vLocal;', 'varying vec3 vLocal;\nfloat vGlass = 0.0;')
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.06, vGlass);`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
metalnessFactor = mix(metalnessFactor, 0.55, vGlass);`,
      );
  };
  return m;
}

/** The body as one mesh. Each vertex carries `section`, its u position on the cross-section. */
export function bodyGeometry(stations = 220): THREE.BufferGeometry {
  const pos: number[] = [];
  const sec: number[] = [];
  const idx: number[] = [];
  const rings: number[] = [];
  for (let i = 0; i <= stations; i++) {
    const z = NOSE + ((TAIL - NOSE) * i) / stations;
    const ring = crossSection(station(z));
    rings.push(pos.length / 3);
    for (const p of ring) {
      pos.push(p.x, p.y, z);
      sec.push(p.u);
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
  // Caps: separate vertices (flat normals), fanned from the centre of the end rings.
  for (const [ringStart, flip] of [
    // The nose cap faces +Z and the tail cap −Z; the ring winds counter-clockwise seen from +Z.
    [rings[0]!, true],
    [rings[stations]!, false],
  ] as const) {
    const base = pos.length / 3;
    let cx = 0;
    let cy = 0;
    const cz = pos[ringStart * 3 + 2]!;
    // Section 4.2 paints the nose cap body colour; 9 marks the tail cap for the shader.
    const capSection = flip ? 4.2 : 9;
    for (let j = 0; j < RING; j++) {
      const x = pos[(ringStart + j) * 3]!;
      const y = pos[(ringStart + j) * 3 + 1]!;
      cx += x;
      cy += y;
      pos.push(x, y, cz);
      sec.push(capSection);
    }
    const center = pos.length / 3;
    pos.push(cx / RING, cy / RING, cz);
    sec.push(capSection);
    for (let j = 0; j < RING; j++) {
      const j2 = (j + 1) % RING;
      if (flip) idx.push(center, base + j, base + j2);
      else idx.push(center, base + j2, base + j);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('section', new THREE.Float32BufferAttribute(sec, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
