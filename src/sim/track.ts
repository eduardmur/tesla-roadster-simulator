/**
 * The test site: one runway and the curl ramp. Shared by the physics colliders
 * (src/sim/world.ts) and the visuals (src/scene/environment), so they always match.
 *
 * World frame: +Y up, +Z toward the ramp.
 */
import { SPECS } from '../data/specs';
import type { V3 } from '../physics/math';

export interface CurlSpec {
  /** Lane centre (x). */
  x: number;
  /** Where the curl leaves the ground (z). */
  z0: number;
  radius: number;
  /** Total turn of the curl, radians (reported: 170°). */
  arc: number;
  width: number;
  thickness: number;
}

const DEG = Math.PI / 180;

/** The reveal ramp: reported 170° end pitch, ~21 m up; circular shape and radius are our estimate. */
export const RAMP: CurlSpec = {
  x: 0,
  z0: 0,
  radius: SPECS.rampRadius.value,
  arc: SPECS.rampPitch.value * DEG,
  width: SPECS.rampWidth.value,
  thickness: 0.35,
};

/** Point on the riding surface at curl angle θ (0 = on the ground). */
export function curlPoint(c: CurlSpec, theta: number, x = c.x): V3 {
  return [x, c.radius - c.radius * Math.cos(theta), c.z0 + c.radius * Math.sin(theta)];
}

/** Surface normal (toward the curl's centre) at θ. */
export function curlNormal(theta: number): V3 {
  return [0, Math.cos(theta), -Math.sin(theta)];
}

/** Height of the inverted end above the ground. */
export const curlTopHeight = (c: CurlSpec): number => c.radius * (1 - Math.cos(c.arc));

/** Curl angle of the point on the surface closest to p (for progress tracking). */
export function curlAngleAt(c: CurlSpec, p: V3): number {
  const a = Math.atan2(p[2] - c.z0, c.radius - p[1]);
  // Angles just behind the curl's start come out slightly negative; keep them that way.
  return a < -Math.PI / 2 ? a + 2 * Math.PI : a;
}

export interface SurfaceMesh {
  positions: Float32Array;
  indices: Uint32Array;
}

/** Riding surface of the curl as a triangle strip (used for the trimesh collider). */
export function curlSurface(c: CurlSpec, segments = 96): SurfaceMesh {
  const pos: number[] = [];
  const idx: number[] = [];
  const half = c.width / 2;
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * c.arc;
    const left = curlPoint(c, t, c.x + half);
    const right = curlPoint(c, t, c.x - half);
    if (i === 0) {
      // Start a hair below the ground so the transition is seamless.
      left[1] -= 0.004;
      right[1] -= 0.004;
    }
    pos.push(...left, ...right);
    if (i < segments) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}

/** The approach runway in front of the ramp. */
export const RUNWAY = { x: 0, start: -170, end: RAMP.z0, width: 14, lampSpacing: 10 };

/** The test site: a round pad with a concrete wall around it, so nobody drives off the world. */
export const SITE = { x: 0, z: -200, radius: 600, wallHeight: 1.2, segments: 120 };

/** Straight wall segments around the site (centre, yaw about +Y, length). */
export function wallSegments(): { x: number; z: number; yaw: number; length: number }[] {
  const n = SITE.segments;
  const length = 2 * SITE.radius * Math.sin(Math.PI / n) + 0.4;
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return {
      x: SITE.x + Math.cos(a) * SITE.radius,
      z: SITE.z + Math.sin(a) * SITE.radius,
      // The segment runs along the tangent of the circle.
      yaw: -a + Math.PI / 2,
      length,
    };
  });
}

export interface Spawn {
  position: V3;
  /** Heading about Y; 0 = facing +Z (toward the ramp). */
  yaw: number;
}

export const SPAWNS = {
  /** Parked on the runway, facing the ramp. */
  start: { position: [RAMP.x, 0, -32], yaw: 0 } as Spawn,
  /** Open flat ground away from the ramp (used by tests). */
  flat: { position: [-80, 0, -150], yaw: 0 } as Spawn,
};

export type SpawnId = keyof typeof SPAWNS;
