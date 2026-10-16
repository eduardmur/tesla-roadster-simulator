/**
 * Procedural geometry for our original low wedge coupe. Everything is built from 2D
 * profiles (extrusions) and lathes, in the body frame: +X left, +Y up, +Z forward,
 * origin at the centre of mass. No external models.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BODY, WHEEL_RADIUS } from '../../physics/layout';

type P = [number, number];

/** A profile segment: straight lines through points, or a smooth spline through them. */
type Seg = { line: P[] } | { spline: P[] };

function buildShape(start: P, segs: Seg[]): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(start[0], start[1]);
  for (const seg of segs) {
    if ('line' in seg) for (const [u, v] of seg.line) shape.lineTo(u, v);
    else shape.splineThru(seg.spline.map(([u, v]) => new THREE.Vector2(u, v)));
  }
  shape.closePath();
  return shape;
}

/** Extrude a side profile (u = z, v = y) across the car between x0 and x1. */
function extrudeShape(
  shape: THREE.Shape,
  x0: number,
  x1: number,
  bevel = 0.04,
  curveSegments = 24,
  bevelSegments = 4,
): THREE.BufferGeometry {
  const depth = Math.max(Math.abs(x1 - x0) - 2 * bevel, 0.01);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments,
    curveSegments,
  });
  // Shape lies in XY with extrusion along +Z (bevel adds ±bevel). rotateY(−90°) maps
  // shape-x → car z and extrusion z ∈ [−b, depth + b] → car x ∈ [−depth − b, b].
  geo.rotateY(-Math.PI / 2);
  geo.translate(Math.max(x0, x1) - bevel, 0, 0);
  geo.computeVertexNormals();
  return geo;
}

function arch(cz: number, cy: number, r: number, bottom: number): P[] {
  const s = Math.asin((bottom - cy) / r); // negative
  const a0 = Math.PI - s; // e.g. 210°
  const a1 = s; // e.g. −30°
  const pts: P[] = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cz + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

export const WHEEL_VISUAL_Y = -0.09;
const ARCH_R = 0.42;
export const FRONT_Z = 1.36;
export const REAR_Z = -1.4;

/** Centre tub between the fenders: nose, hood, rear deck, diffuser. */
export function tubGeometry(): THREE.BufferGeometry {
  const shape = buildShape(
    [2.1, -0.3],
    [
      { line: [[2.18, -0.17]] },
      {
        spline: [
          [2.15, -0.07],
          [1.85, 0.03],
          [1.4, 0.1],
          [0.85, 0.15],
        ],
      },
      { line: [[-0.95, 0.23]] },
      {
        spline: [
          [-1.5, 0.235],
          [-1.9, 0.21],
          [-2.13, 0.14],
        ],
      },
      {
        line: [
          [-2.16, -0.02],
          [-2.04, -0.14],
          [-1.75, -0.32],
          [1.85, -0.32],
        ],
      },
    ],
  );
  return extrudeShape(shape, -0.7, 0.7, 0.05);
}

/** One side pod (fender line with both wheel arches). `side` = +1 left, −1 right. */
export function podGeometry(side: 1 | -1): THREE.BufferGeometry {
  const bottom = -0.3;
  const shape = buildShape(
    [2.12, -0.07],
    [
      {
        spline: [
          [1.95, 0.12],
          [1.62, 0.31],
          [1.36, 0.37],
          [1.08, 0.31],
          [0.72, 0.21],
          [0.2, 0.17],
          [-0.45, 0.21],
          [-0.98, 0.34],
          [-1.4, 0.42],
          [-1.84, 0.36],
          [-2.08, 0.24],
          [-2.16, 0.1],
        ],
      },
      {
        line: [
          [-2.16, -0.1],
          [-2.0, bottom],
        ],
      },
      { line: arch(REAR_Z, WHEEL_VISUAL_Y, ARCH_R, bottom) },
      { line: arch(FRONT_Z, WHEEL_VISUAL_Y, ARCH_R, bottom) },
      { line: [[2.05, -0.28]] },
    ],
  );
  const x0 = side > 0 ? 0.64 : -1.0;
  const x1 = side > 0 ? 1.0 : -0.64;
  return extrudeShape(shape, x0, x1, 0.07, 32, 5);
}

/** Glass canopy, narrowing toward the roof. */
export function canopyGeometry(): THREE.BufferGeometry {
  const shape = buildShape(
    [0.98, 0.13],
    [
      {
        spline: [
          [0.6, 0.33],
          [0.1, 0.57],
          [-0.45, 0.635],
          [-1.0, 0.5],
          [-1.5, 0.25],
        ],
      },
      {
        line: [
          [-1.3, 0.2],
          [-0.9, 0.2],
        ],
      },
    ],
  );
  const geo = extrudeShape(shape, -0.66, 0.66, 0.08, 32, 5);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = THREE.MathUtils.clamp((y - 0.15) / 0.5, 0, 1);
    pos.setX(i, pos.getX(i) * (1 - 0.25 * t));
  }
  geo.computeVertexNormals();
  return geo;
}

/** Dark lower parts: side sills, front splitter, diffuser fins and wheel-well liners. */
export function trimGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const sx of [1, -1]) {
    const sill = new THREE.BoxGeometry(0.34, 0.07, 1.86);
    sill.translate(sx * 0.83, -0.29, (FRONT_Z + REAR_Z) / 2);
    parts.push(sill);
    for (const z of [FRONT_Z, REAR_Z]) {
      const liner = new THREE.CylinderGeometry(
        ARCH_R + 0.01,
        ARCH_R + 0.01,
        0.3,
        28,
        1,
        true,
        Math.PI * 0.05,
        Math.PI * 0.9,
      );
      liner.rotateZ(Math.PI / 2);
      liner.rotateX(Math.PI / 2);
      liner.translate(sx * 0.83, WHEEL_VISUAL_Y, z);
      parts.push(liner);
    }
  }
  const splitter = new THREE.BoxGeometry(1.86, 0.025, 0.28);
  splitter.translate(0, -0.315, 2.0);
  parts.push(splitter);
  for (let i = -2; i <= 2; i++) {
    const fin = new THREE.BoxGeometry(0.02, 0.08, 0.4);
    fin.rotateX(-0.25);
    fin.translate(i * 0.36, -0.3, -1.9);
    parts.push(fin);
  }
  return mergeGeometries(parts.map((g) => g.toNonIndexed()))!;
}

/** Thin emissive light bars front and rear. */
export function lightBarGeometry(front: boolean): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(front ? 1.75 : 1.85, 0.025, 0.04);
  g.translate(0, front ? -0.06 : 0.1, front ? 2.13 : -2.17);
  return g;
}

/** Tire + rim as one lathe, axis along X. */
export function tireGeometry(): THREE.BufferGeometry {
  const r = WHEEL_RADIUS;
  const w = 0.14;
  const prof: THREE.Vector2[] = [
    new THREE.Vector2(r - 0.1, -w),
    new THREE.Vector2(r - 0.02, -w),
    new THREE.Vector2(r, -w + 0.04),
    new THREE.Vector2(r, w - 0.04),
    new THREE.Vector2(r - 0.02, w),
    new THREE.Vector2(r - 0.1, w),
  ];
  const g = new THREE.LatheGeometry(prof, 40);
  g.rotateZ(Math.PI / 2);
  return g;
}

export function rimGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const disc = new THREE.CylinderGeometry(WHEEL_RADIUS - 0.1, WHEEL_RADIUS - 0.1, 0.05, 40);
  disc.rotateZ(Math.PI / 2);
  disc.translate(0.06, 0, 0);
  parts.push(disc);
  const n = 12;
  for (let i = 0; i < n; i++) {
    const blade = new THREE.BoxGeometry(0.03, 0.035, WHEEL_RADIUS - 0.13);
    blade.translate(0, 0, (WHEEL_RADIUS - 0.13) / 2 + 0.05);
    blade.rotateY(0.25);
    blade.translate(0.1, 0, 0);
    blade.rotateX((i / n) * Math.PI * 2);
    parts.push(blade);
  }
  const hub = new THREE.CylinderGeometry(0.06, 0.06, 0.06, 20);
  hub.rotateZ(Math.PI / 2);
  hub.translate(0.11, 0, 0);
  parts.push(hub);
  return mergeGeometries(parts.map((g) => g.toNonIndexed()))!;
}

/** Converging–diverging nozzle bell. Axis along +Y (exit at y = 0, inlet above). */
export function nozzleGeometry(exitRadius: number, length: number): THREE.BufferGeometry {
  const throat = exitRadius / Math.sqrt(8);
  const prof: THREE.Vector2[] = [];
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // Bell from throat (t = 0) to exit (t = 1).
    const r = throat + (exitRadius - throat) * Math.pow(t, 0.7);
    prof.push(new THREE.Vector2(r, length * 0.55 * (1 - t)));
  }
  // Converging inlet above the throat.
  prof.unshift(new THREE.Vector2(throat * 2.2, length));
  prof.unshift(new THREE.Vector2(throat * 2.4, length * 1.05));
  const g = new THREE.LatheGeometry(prof.reverse(), 24);
  return g;
}

/** Spherical COPV (main tank, behind the seats). */
export function sphereTankGeometry(volumeM3: number): THREE.BufferGeometry {
  const r = Math.cbrt((3 * volumeM3) / (4 * Math.PI));
  return new THREE.SphereGeometry(r, 40, 28);
}

/** Capsule COPV (Rocket's passenger-seat tank), axis along Z. */
export function capsuleTankGeometry(volumeM3: number, radius = 0.32): THREE.BufferGeometry {
  const sphere = (4 / 3) * Math.PI * radius ** 3;
  const len = Math.max((volumeM3 - sphere) / (Math.PI * radius * radius), 0.05);
  const g = new THREE.CapsuleGeometry(radius, len, 12, 28);
  g.rotateX(Math.PI / 2);
  return g;
}

/** Ducted fan rotor (blades), axis along Y. */
export function fanRotorGeometry(radius: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const hub = new THREE.CylinderGeometry(radius * 0.25, radius * 0.25, 0.05, 20);
  parts.push(hub);
  const blades = 9;
  for (let i = 0; i < blades; i++) {
    const b = new THREE.BoxGeometry(radius * 0.72, 0.012, radius * 0.22);
    b.translate(radius * 0.58, 0, 0);
    b.rotateX(0.35);
    b.rotateY((i / blades) * Math.PI * 2);
    parts.push(b);
  }
  return mergeGeometries(parts)!;
}

export function fanDuctGeometry(radius: number): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(radius + 0.03, radius + 0.03, 0.12, 32, 1, true);
}

/** Tube along a polyline (pipes). */
export function pipeGeometry(
  points: [number, number, number][],
  radius = 0.018,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
    false,
    'catmullrom',
    0.2,
  );
  return new THREE.TubeGeometry(curve, Math.max(16, points.length * 10), radius, 8, false);
}

export const FLOOR_Y = -BODY.comHeight + BODY.floorClearance + 0.03;
