/**
 * Layout and geometry of the desert test pad. Shared by the physics colliders
 * (src/sim/world.ts) and the visuals (src/scene/environment), so they always match.
 *
 * World frame: +Y up, +Z "north". The pad is centred on the origin.
 */
import { SPECS } from '../data/specs';
import type { V3 } from '../physics/math';

export interface CurlSpec {
  id: 'curl' | 'practice';
  label: string;
  /** Lane centre (x). */
  x: number;
  /** Where the curl leaves the ground (z). */
  z0: number;
  radius: number;
  /** Total turn of the curl, radians (reported: 170°). */
  arc: number;
  width: number;
  thickness: number;
  /** Run-in start (z) where challenges spawn the car. */
  runInStart: number;
}

const DEG = Math.PI / 180;

export const CURLS: Record<CurlSpec['id'], CurlSpec> = {
  curl: {
    id: 'curl',
    label: 'The Curl (as reported: 170°, ~21 m)',
    x: 34,
    z0: 0,
    radius: SPECS.rampRadius.value,
    arc: SPECS.rampPitch.value * DEG,
    width: SPECS.rampWidth.value,
    thickness: 0.35,
    runInStart: -150,
  },
  practice: {
    id: 'practice',
    label: 'Practice curl (estimate: 7 m radius)',
    x: 62,
    z0: 0,
    radius: SPECS.practiceRampRadius.value,
    arc: SPECS.rampPitch.value * DEG,
    width: SPECS.rampWidth.value,
    thickness: 0.3,
    runInStart: -110,
  },
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
  const dz = p[2] - c.z0;
  const dy = c.radius - p[1];
  const a = Math.atan2(dz, dy);
  // Angles just behind the curl's start come out slightly negative; keep them that way.
  return a < -Math.PI / 2 ? a + 2 * Math.PI : a;
}

export interface SurfaceMesh {
  positions: Float32Array;
  indices: Uint32Array;
}

/** Riding surface of a curl as a triangle strip (used for the trimesh collider). */
export function curlSurface(c: CurlSpec, segments = 96): SurfaceMesh {
  const pos: number[] = [];
  const idx: number[] = [];
  const half = c.width / 2;
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * c.arc;
    // Start a hair below the ground so the transition is seamless.
    const left = curlPoint(c, t, c.x + half);
    const right = curlPoint(c, t, c.x - half);
    if (i === 0) {
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

// ---------------------------------------------------------------------------------- tube

export interface TubeSpec {
  x: number;
  z: number;
  radius: number;
  length: number;
}

/** Wall-and-ceiling test tube: a horizontal cylinder whose floor is flush with the ground. */
export const TUBE: TubeSpec = { x: 100, z: -10, radius: 9, length: 70 };

export function tubeSurface(t: TubeSpec, around = 72, along = 14): SurfaceMesh {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= along; j++) {
    const z = t.z - t.length / 2 + (j / along) * t.length;
    for (let i = 0; i <= around; i++) {
      const a = (i / around) * Math.PI * 2;
      pos.push(t.x + t.radius * Math.sin(a), t.radius - t.radius * Math.cos(a) - 0.004, z);
    }
  }
  const row = around + 1;
  for (let j = 0; j < along; j++) {
    for (let i = 0; i < around; i++) {
      const a = j * row + i;
      idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}

// ---------------------------------------------------------------------------------- tilt rig

export interface TiltRigSpec {
  x: number;
  z: number;
  /** Axle height; the slab's top face passes through the axle. */
  axleHeight: number;
  length: number;
  width: number;
  thickness: number;
}

/** "Tilt the road" rig from tour chapter 2: a slab that rotates about a lengthwise axle. */
export const TILT_RIG: TiltRigSpec = {
  x: -110,
  z: 40,
  axleHeight: 7,
  length: 12,
  width: 5.5,
  thickness: 0.5,
};

// ---------------------------------------------------------------------------------- props

export interface BoxProp {
  center: V3;
  halfExtents: V3;
  /** Rotation about Y, radians. */
  yaw: number;
  color: string;
}

export interface ParkedCar {
  center: V3;
  yaw: number;
  color: string;
}

export const HOP_LANE = { x: -60, start: -80, carsZ: 30 };

/** Generic boxy cars parked side by side across the hop lane. */
export const PARKED_CARS: ParkedCar[] = [0, 1, 2, 3].map((i) => ({
  center: [HOP_LANE.x - 3.3 + i * 2.2, 0, HOP_LANE.carsZ] as V3,
  yaw: 0,
  color: ['#7d8794', '#a9a39a', '#5f6b7a', '#8a7f72'][i]!,
}));

/** A parked car is a body box plus a cabin box (half extents, local frame, length along local Z). */
export const PARKED_CAR_BOXES: { offset: V3; half: V3 }[] = [
  { offset: [0, 0.55, 0], half: [0.9, 0.4, 2.2] },
  { offset: [0, 1.2, -0.2], half: [0.8, 0.3, 1.2] },
];

export const PARKED_CAR_HEIGHT = 1.5;

export const HOVER_PAD = { x: -100, z: -70, radius: 9, targetHeight: 2, band: 0.5 };

export const DRAG_STRIP = { x: -30, start: -150, length: 402.336, width: 14 };
/** 1/8 mile from the start line. */
export const EIGHTH_MILE = 201.168;

export interface Spawn {
  position: V3;
  /** Heading about Y; 0 = facing +Z. */
  yaw: number;
}

export const SPAWNS = {
  hub: { position: [0, 0, -40], yaw: 0 } as Spawn,
  drag: { position: [DRAG_STRIP.x, 0, DRAG_STRIP.start - 4], yaw: 0 } as Spawn,
  curl: { position: [CURLS.curl.x, 0, CURLS.curl.runInStart], yaw: 0 } as Spawn,
  practice: { position: [CURLS.practice.x, 0, CURLS.practice.runInStart], yaw: 0 } as Spawn,
  hop: { position: [HOP_LANE.x, 0, HOP_LANE.start], yaw: 0 } as Spawn,
  hover: { position: [HOVER_PAD.x, 0, HOVER_PAD.z], yaw: 0 } as Spawn,
  tube: { position: [TUBE.x, 0, TUBE.z - TUBE.length / 2 - 30], yaw: 0 } as Spawn,
  tilt: {
    position: [TILT_RIG.x, TILT_RIG.axleHeight, TILT_RIG.z],
    yaw: 0,
  } as Spawn,
};

export type SpawnId = keyof typeof SPAWNS;

/** Traffic cones (visual only), along the lanes. */
export function conePositions(): V3[] {
  const out: V3[] = [];
  for (let z = -140; z <= 260; z += 20) {
    out.push([DRAG_STRIP.x - DRAG_STRIP.width / 2 - 1, 0, z]);
    out.push([DRAG_STRIP.x + DRAG_STRIP.width / 2 + 1, 0, z]);
  }
  for (const c of Object.values(CURLS)) {
    for (let z = c.runInStart + 10; z < c.z0 - 30; z += 15) {
      out.push([c.x - c.width / 2 - 1.5, 0, z]);
      out.push([c.x + c.width / 2 + 1.5, 0, z]);
    }
  }
  for (let z = HOP_LANE.start + 10; z < HOP_LANE.carsZ - 8; z += 12) {
    out.push([HOP_LANE.x - 6, 0, z]);
    out.push([HOP_LANE.x + 6, 0, z]);
  }
  return out;
}
