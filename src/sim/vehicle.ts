/**
 * Raycast vehicle on a Rapier rigid body.
 *
 * Each wheel casts a ray along the car's local −Y. The hit gives the suspension compression
 * (spring + damper + bump stop). The tire then pushes along the contact plane with a
 * friction circle of radius μ·N from src/physics/tires.ts, so suction (which raises N)
 * raises grip exactly as in the pure model. Every direction is in the car's own frame, so
 * the same code drives on floors, walls and ceilings.
 */
import type RAPIER from '@dimforge/rapier3d-compat';
import {
  SUSPENSION_REST,
  SUSPENSION_TRAVEL,
  WHEEL_RADIUS,
  WHEELS,
  type WheelLayout,
} from '../physics/layout';
import {
  add,
  cross,
  dot,
  normalize,
  rotate,
  scale,
  sub,
  type Quat,
  type V3,
} from '../physics/math';
import { motorForce, type VehicleParams } from '../physics/params';
import { frictionCircle, gripLimit } from '../physics/tires';
import type { DriveInput } from './types';

export type Rapier = typeof RAPIER;

// Game-feel tuning (never shown on screen, so not specs; see docs/DECISIONS.md).
const SPRING = 260_000; // N/m per corner
const DAMPER = 12_000; // N·s/m per corner
const BUMP = 2_000_000; // N/m beyond travel
const ANTI_ROLL = 40_000; // N/m per axle
const MAX_STEER = 0.6; // rad at standstill
const STEER_SPEED_SCALE = 18; // m/s at which max steer halves
const STEER_RATE = 3.5; // rad/s
const REVERSE_MAX = 12; // m/s
const REVERSE_FORCE = 0.3;
const VELOCITY_CANCEL = 0.45;

export interface WheelRuntime {
  layout: WheelLayout;
  contact: boolean;
  compression: number;
  prevCompression: number;
  load: number;
  utilization: number;
  spin: number;
  spinRate: number;
  steer: number;
  surface: string;
  contactPoint: V3;
  normal: V3;
  /** Tire force in the contact plane, world frame (for telemetry). */
  force: V3;
}

export interface Pose {
  pos: V3;
  rot: Quat;
  linvel: V3;
  angvel: V3;
  up: V3;
  forward: V3;
  left: V3;
}

export const vec = (v: { x: number; y: number; z: number }): V3 => [v.x, v.y, v.z];
export const rv = (v: V3) => ({ x: v[0], y: v[1], z: v[2] });

export function readPose(body: RAPIER.RigidBody): Pose {
  const t = body.translation();
  const r = body.rotation();
  const rot: Quat = [r.x, r.y, r.z, r.w];
  return {
    pos: [t.x, t.y, t.z],
    rot,
    linvel: vec(body.linvel()),
    angvel: vec(body.angvel()),
    up: rotate(rot, [0, 1, 0]),
    forward: rotate(rot, [0, 0, 1]),
    left: rotate(rot, [1, 0, 0]),
  };
}

export function createWheels(): WheelRuntime[] {
  return WHEELS.map((layout) => ({
    layout,
    contact: false,
    compression: 0,
    prevCompression: 0,
    load: 0,
    utilization: 0,
    spin: 0,
    spinRate: 0,
    steer: 0,
    surface: '',
    contactPoint: [0, 0, 0],
    normal: [0, 1, 0],
    force: [0, 0, 0],
  }));
}

export interface WheelStepContext {
  R: Rapier;
  world: RAPIER.World;
  body: RAPIER.RigidBody;
  params: VehicleParams;
  pose: Pose;
  input: DriveInput;
  dt: number;
  mass: number;
  /** Collider handle → surface label. */
  labels: Map<number, string>;
  /** Holds the brakes fully (the car waits after a run); no reverse. */
  holdBrake: boolean;
  /** Moving platforms (the tilt rig), keyed by surface label. */
  platforms: Map<string, RAPIER.RigidBody>;
}

export interface WheelStepResult {
  contacts: number;
  gripLimit: number;
  tireForce: V3;
  maxUtilization: number;
  steer: number;
  surface: string;
}

export function maxSteerAt(speed: number): number {
  return MAX_STEER / (1 + Math.abs(speed) / STEER_SPEED_SCALE);
}

/** Advance all four wheels: raycast, suspension, tire forces. Applies impulses to the body. */
export function stepWheels(
  ctx: WheelStepContext,
  wheels: WheelRuntime[],
  steerState: { value: number },
): WheelStepResult {
  const { R, world, body, params, pose, input, dt, mass } = ctx;
  const down = scale(pose.up, -1);
  const rayLength = SUSPENSION_REST + WHEEL_RADIUS;
  const forwardSpeed = dot(pose.linvel, pose.forward);

  // Steering: speed-sensitive and rate-limited.
  const targetSteer = input.steer * maxSteerAt(forwardSpeed);
  const ds = targetSteer - steerState.value;
  steerState.value += Math.sign(ds) * Math.min(Math.abs(ds), STEER_RATE * dt);

  // Pass 1: raycasts and suspension.
  for (const w of wheels) {
    const anchor = add(pose.pos, rotate(pose.rot, w.layout.anchor));
    const hit = world.castRayAndGetNormal(
      new R.Ray(rv(anchor), rv(down)),
      rayLength,
      true,
      undefined,
      undefined,
      undefined,
      body,
    );
    w.prevCompression = w.compression;
    w.steer = w.layout.steer ? steerState.value : 0;
    if (hit) {
      w.contact = true;
      w.compression = rayLength - hit.timeOfImpact;
      w.contactPoint = add(anchor, scale(down, hit.timeOfImpact));
      let n = vec(hit.normal);
      if (dot(n, pose.up) < 0) n = scale(n, -1);
      w.normal = n;
      w.surface = ctx.labels.get(hit.collider.handle) ?? 'ground';
    } else {
      w.contact = false;
      w.compression = 0;
      w.surface = '';
    }
  }

  // Anti-roll bars couple left/right compression on each axle.
  const antiRoll = [0, 0, 0, 0];
  for (const [a, b] of [
    [0, 1],
    [2, 3],
  ] as const) {
    const wa = wheels[a]!;
    const wb = wheels[b]!;
    if (wa.contact && wb.contact) {
      const f = (wa.compression - wb.compression) * ANTI_ROLL;
      antiRoll[a] = f;
      antiRoll[b] = -f;
    }
  }

  const contacts = wheels.filter((w) => w.contact).length;
  const drivenInContact = wheels.filter((w) => w.contact && w.layout.driven).length;

  // Drive force: motors, or reverse when braking at a standstill.
  let drive = 0;
  let brake = input.brake;
  if (input.throttle > 0 && !ctx.holdBrake) {
    drive = motorForce(params, forwardSpeed, input.throttle);
  } else if (input.brake > 0 && forwardSpeed < 0.5) {
    brake = 0;
    if (forwardSpeed > -REVERSE_MAX) drive = -REVERSE_FORCE * params.motorPeakForce * input.brake;
  }
  if (ctx.holdBrake) brake = 1;
  const hold = input.throttle <= 0 && Math.abs(forwardSpeed) < 1.5 && drive === 0;

  let gripSum = 0;
  let maxUtil = 0;
  let tireForce: V3 = [0, 0, 0];
  const mEff = mass / 4;
  let surface = '';

  // Pass 2: forces.
  for (let i = 0; i < wheels.length; i++) {
    const w = wheels[i]!;
    if (!w.contact) {
      w.load = 0;
      w.utilization = 0;
      w.force = [0, 0, 0];
      w.spinRate *= Math.exp(-dt * 0.8);
      w.spin += w.spinRate * dt;
      continue;
    }
    surface ||= w.surface;
    const x = w.compression;
    const xdot = (x - w.prevCompression) / dt;
    let fs = SPRING * x + DAMPER * xdot + antiRoll[i]!;
    if (x > SUSPENSION_TRAVEL) fs += BUMP * (x - SUSPENSION_TRAVEL);
    fs = Math.max(0, fs);
    w.load = fs;

    const n = w.normal;
    const steerDir = rotate(pose.rot, [Math.sin(w.steer), 0, Math.cos(w.steer)]);
    const f = normalize(sub(steerDir, scale(n, dot(n, steerDir))));
    const s = normalize(cross(n, f));

    const r = sub(w.contactPoint, pose.pos);
    let v = add(pose.linvel, cross(pose.angvel, r));
    const platform = ctx.platforms.get(w.surface);
    if (platform) v = sub(v, vec(platform.velocityAtPoint(rv(w.contactPoint))));
    const vx = dot(v, f);
    const vy = dot(v, s);

    const limit = gripLimit(params.mu, fs);
    gripSum += limit;

    let fx = 0;
    if (w.layout.driven && drivenInContact > 0) fx += drive / drivenInContact;
    if (brake > 0) {
      const cancel = (Math.abs(vx) * mEff * VELOCITY_CANCEL) / dt;
      fx += -Math.sign(vx) * Math.min(cancel, brake * limit * 1.2);
    }
    if (hold) fx += (-vx * mEff * VELOCITY_CANCEL) / dt;
    fx += -params.rollingResistance * fs * Math.tanh(vx / 0.5);

    const vs = Math.max(0.3, 0.05 * Math.abs(vx));
    const curve = limit * Math.tanh(Math.abs(vy) / vs);
    const cancel = (Math.abs(vy) * mEff * VELOCITY_CANCEL) / dt;
    const fy = -Math.sign(vy) * Math.min(curve, cancel);

    const fc = frictionCircle(fx, fy, limit);
    w.utilization = fc.utilization;
    maxUtil = Math.max(maxUtil, fc.utilization);

    // Raise the tire force application point a little toward the COM to tame roll-over.
    const tireForceWorld = add(scale(f, fc.fx), scale(s, fc.fy));
    w.force = tireForceWorld;
    tireForce = add(tireForce, tireForceWorld);
    const tirePoint = add(w.contactPoint, scale(pose.up, 0.2));
    body.applyImpulseAtPoint(rv(scale(tireForceWorld, dt)), rv(tirePoint), true);
    body.applyImpulseAtPoint(rv(scale(pose.up, fs * dt)), rv(w.contactPoint), true);

    // Wheel spin: rolls with the ground, spins up when sliding under power.
    const slipSpin = fc.sliding && Math.abs(fx) > 0 ? Math.sign(fx) * 8 : 0;
    w.spinRate = vx / WHEEL_RADIUS + slipSpin;
    w.spin += w.spinRate * dt;
  }

  return {
    contacts,
    gripLimit: gripSum,
    tireForce,
    maxUtilization: maxUtil,
    steer: steerState.value,
    surface,
  };
}
