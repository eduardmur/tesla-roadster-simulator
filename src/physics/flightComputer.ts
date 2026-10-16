/**
 * Rocket flight computer.
 *
 * Inner loop: body-rate controller  τ = I·k_rate·(ω_cmd − ω).
 * Outer loop: attitude (auto-level, roll-180 assist) → ω_cmd with a time-optimal-ish
 *             profile ω = min(ω_max, √(2·½α·|err|), k_att·|err|).
 * Lift:       vertical-speed controller; the landing assist follows a braking profile
 *             v_z,target = −√(v_touch² + 2·f·a_avail·h), which waits as long as it can and
 *             then burns (a "suicide burn") to save air.
 * Mixer:      4 lift nozzles → (lift, pitch torque, roll torque) via pseudo-inverse with
 *             saturation handling; 2 yaw nozzles → yaw torque.
 *
 * Body frame: +X left, +Y up, +Z forward. Positive ω_x = nose down, ω_y = nose left,
 * ω_z = roll right (right side down).
 */
import { clamp, cross, lerp, toBody, type Quat, type V3 } from './math';

export interface FlightThruster {
  position: V3;
  /** Unit force direction on the car, body frame. */
  direction: V3;
  /** Thrust available right now at 100 % duty (depends on tank pressure), N. */
  maxThrust: number;
  /** Highest duty the trim allows. */
  maxDuty: number;
}

export interface FlightCommand {
  /** −1..1, + = nose down. */
  pitch: number;
  /** −1..1, + = roll right. */
  roll: number;
  /** −1..1, + = nose left. */
  yaw: number;
  /** 0..1 lift request. */
  lift: number;
}

export interface FlightAssists {
  /** Level the car automatically when the pilot gives no attitude input (default on). */
  autoLevel: boolean;
  /** Vertical-speed lift control and automatic landing burn (default on). */
  landingAssist: boolean;
}

export interface FlightSensors {
  orientation: Quat;
  /** Body-frame angular velocity, rad/s. */
  angularVelocity: V3;
  /** World velocity, m/s. */
  velocity: V3;
  /** Height of the wheels above the ground below, m (Infinity if unknown). */
  heightAboveGround: number;
  airborne: boolean;
  mass: number;
  gravity: number;
  /** Principal inertia (pitch, yaw, roll), kg·m². */
  inertia: V3;
}

export type FlightMode = 'idle' | 'manual' | 'level' | 'roll180' | 'landing' | 'lift';

export interface FlightOutput {
  /** Duty per lift nozzle, 0..1. */
  down: number[];
  /** Duty per yaw nozzle, 0..1. */
  yaw: number[];
  mode: FlightMode;
  /** Collective lift force requested, N. */
  liftForce: number;
  /** Torque requested (body frame), N·m. */
  torque: V3;
  /** Roll-180 progress 0..1 (0 when inactive). */
  rollProgress: number;
}

export interface FlightGains {
  rate: number;
  attitude: number;
  maxRate: V3;
  vertical: number;
  touchdownSpeed: number;
  /** Fraction of available deceleration the landing profile plans with. */
  planFraction: number;
  climbRate: number;
  sinkRate: number;
}

export const DEFAULT_GAINS: FlightGains = {
  rate: 10,
  attitude: 5,
  maxRate: [2.5, 1.5, 5],
  vertical: 3,
  touchdownSpeed: 1.5,
  planFraction: 0.6,
  climbRate: 3,
  sinkRate: -1,
};

const IDLE = (down: number, yaw: number): FlightOutput => ({
  down: new Array<number>(down).fill(0),
  yaw: new Array<number>(yaw).fill(0),
  mode: 'idle',
  liftForce: 0,
  torque: [0, 0, 0],
  rollProgress: 0,
});

/** Solve the 3×3 system M·x = b (Cramer's rule; M is small and well conditioned here). */
function solve3(m: number[][], b: V3): V3 {
  const [a, bb, c] = m as [number[], number[], number[]];
  const det = (r0: number[], r1: number[], r2: number[]) =>
    r0[0]! * (r1[1]! * r2[2]! - r1[2]! * r2[1]!) -
    r0[1]! * (r1[0]! * r2[2]! - r1[2]! * r2[0]!) +
    r0[2]! * (r1[0]! * r2[1]! - r1[1]! * r2[0]!);
  const D = det(a, bb, c);
  if (Math.abs(D) < 1e-12) return [0, 0, 0];
  const col = (i: number) => [a, bb, c].map((row, r) => row.map((v, j) => (j === i ? b[r]! : v)));
  const [c0, c1, c2] = [col(0), col(1), col(2)] as [number[][], number[][], number[][]];
  return [
    det(c0[0]!, c0[1]!, c0[2]!) / D,
    det(c1[0]!, c1[1]!, c1[2]!) / D,
    det(c2[0]!, c2[1]!, c2[2]!) / D,
  ];
}

export interface MixResult {
  forces: number[];
  /** How much of the requested torque could be delivered (0..1). */
  torqueScale: number;
}

/**
 * Allocate (lift, τx, τz) to lift nozzles. Each nozzle can only push (0 ≤ f ≤ f_max), so a
 * pure torque always comes with some net lift. Torque has priority over lift.
 */
export function mixLift(
  thrusters: FlightThruster[],
  lift: number,
  tauX: number,
  tauZ: number,
): MixResult {
  const n = thrusters.length;
  if (n === 0) return { forces: [], torqueScale: 0 };
  // B rows: lift, τx, τz per unit force of each nozzle.
  const B: number[][] = [[], [], []];
  for (const t of thrusters) {
    const tq = cross(t.position, t.direction);
    B[0]!.push(t.direction[1]);
    B[1]!.push(tq[0]);
    B[2]!.push(tq[2]);
  }
  const BBt = [0, 1, 2].map((i) =>
    [0, 1, 2].map((j) => B[i]!.reduce((s, v, k) => s + v * B[j]![k]!, 0)),
  );
  const pinv = (w: V3): number[] => {
    const y = solve3(BBt, w);
    return thrusters.map((_, k) => B[0]![k]! * y[0] + B[1]![k]! * y[1] + B[2]![k]! * y[2]);
  };
  const k = pinv([1, 0, 0]);
  const d = pinv([0, tauX, tauZ]);
  const fmax = thrusters.map((t) => t.maxThrust * t.maxDuty);

  const bounds = (s: number): [number, number] => {
    let lo = 0;
    let hi = Infinity;
    for (let i = 0; i < n; i++) {
      const ki = Math.max(k[i]!, 1e-9);
      lo = Math.max(lo, (-s * d[i]!) / ki);
      hi = Math.min(hi, (fmax[i]! - s * d[i]!) / ki);
    }
    return [lo, hi];
  };

  let s = 1;
  let [lo, hi] = bounds(1);
  if (lo > hi) {
    let a = 0;
    let b = 1;
    for (let it = 0; it < 24; it++) {
      const mid = 0.5 * (a + b);
      const [l, h] = bounds(mid);
      if (l <= h) a = mid;
      else b = mid;
    }
    s = a;
    [lo, hi] = bounds(s);
  }
  const c = clamp(lift, lo, Math.max(lo, hi));
  const forces = thrusters.map((_, i) => clamp(c * k[i]! + s * d[i]!, 0, fmax[i]!));
  return { forces, torqueScale: s };
}

/** Signed angle error with a time-optimal-style rate profile. */
function rateProfile(err: number, alpha: number, maxRate: number, kAtt: number): number {
  const mag = Math.abs(err);
  const w = Math.min(maxRate, Math.sqrt(Math.max(alpha, 0.1) * mag), kAtt * mag);
  return Math.sign(err) * w;
}

export class FlightComputer {
  gains: FlightGains;
  private rollActive = false;
  private rollDir: 1 | -1 = 1;
  private rollDone = 0;

  constructor(gains: FlightGains = DEFAULT_GAINS) {
    this.gains = gains;
  }

  reset(): void {
    this.rollActive = false;
    this.rollDone = 0;
  }

  get rolling(): boolean {
    return this.rollActive;
  }

  /** Start a 180° roll; direction follows the pilot's roll input if any. */
  requestRoll180(direction: 1 | -1 = 1): void {
    if (this.rollActive) return;
    this.rollActive = true;
    this.rollDir = direction;
    this.rollDone = 0;
  }

  update(
    dt: number,
    s: FlightSensors,
    cmd: FlightCommand,
    assists: FlightAssists,
    down: FlightThruster[],
    yaw: FlightThruster[],
  ): FlightOutput {
    const g = this.gains;
    const active = s.airborne || cmd.lift > 0;
    if (!active || (down.length === 0 && yaw.length === 0)) {
      if (!s.airborne) this.rollActive = false;
      return IDLE(down.length, yaw.length);
    }

    const [Ix, Iy, Iz] = s.inertia;
    const up = toBody(s.orientation, [0, 1, 0]);
    const ω = s.angularVelocity;

    // Torque authority (one side full, other side off) → angular acceleration available.
    let tauXMax = 0;
    let tauZMax = 0;
    let liftMax = 0;
    for (const t of down) {
      const f = t.maxThrust * t.maxDuty;
      const tq = cross(t.position, t.direction);
      tauXMax += 0.5 * f * Math.abs(tq[0]);
      tauZMax += 0.5 * f * Math.abs(tq[2]);
      liftMax += f * t.direction[1];
    }
    const alphaX = tauXMax / Ix;
    const alphaZ = tauZMax / Iz;

    // ---------------- attitude → rate commands
    let mode: FlightMode = 'manual';
    const wantPitch = Math.abs(cmd.pitch) > 0.05;
    const wantRoll = Math.abs(cmd.roll) > 0.05;
    const ωCmd: V3 = [cmd.pitch * g.maxRate[0], cmd.yaw * g.maxRate[1], cmd.roll * g.maxRate[2]];

    if (this.rollActive && s.airborne) {
      mode = 'roll180';
      const remaining = Math.max(Math.PI - this.rollDone, 0);
      ωCmd[2] =
        this.rollDir *
        Math.max(
          0.6,
          Math.abs(rateProfile(remaining, alphaZ * 0.5, g.maxRate[2], g.attitude * 1.5)),
        );
      if (!wantPitch) ωCmd[0] = 0;
      this.rollDone += Math.max(0, ω[2] * this.rollDir) * dt;
      if (remaining < 0.06) this.rollActive = false;
    } else if (assists.autoLevel && s.airborne && !wantPitch && !wantRoll) {
      mode = 'level';
      // Roll error from the (x, y) projection of world-up, pitch error from (z, y).
      let rollErr = -Math.atan2(up[0], up[1]);
      if (Math.abs(rollErr) > Math.PI - 0.15) rollErr = this.rollDir * Math.abs(rollErr);
      const pitchErr = Math.atan2(up[2], Math.max(up[1], 0.05));
      ωCmd[2] = rateProfile(rollErr, alphaZ * 0.5, g.maxRate[2], g.attitude);
      ωCmd[0] =
        Math.abs(rollErr) < 0.6 ? rateProfile(pitchErr, alphaX * 0.5, g.maxRate[0], g.attitude) : 0;
    }

    // Small yaw errors are ignored so the yaw valves don't chatter and waste air.
    const yawErr = ωCmd[1] - ω[1];
    const torque: V3 = [
      Ix * g.rate * (ωCmd[0] - ω[0]),
      Math.abs(yawErr) < 0.03 ? 0 : Iy * g.rate * yawErr,
      Iz * g.rate * (ωCmd[2] - ω[2]),
    ];

    // ---------------- lift
    let liftForce = 0;
    const uy = up[1];
    const vz = s.velocity[1];
    if (assists.landingAssist) {
      if (cmd.lift > 0 && uy > 0.3) {
        mode = mode === 'manual' ? 'lift' : mode;
        const target = lerp(g.sinkRate, g.climbRate, cmd.lift);
        liftForce = (s.mass * (s.gravity + g.vertical * (target - vz))) / uy;
      } else if (s.airborne && uy > 0.5 && vz < -0.3 && Number.isFinite(s.heightAboveGround)) {
        const aAvail = (liftMax * uy) / s.mass - s.gravity;
        const h = Math.max(s.heightAboveGround - 0.2, 0);
        const profile =
          aAvail > 0.2
            ? -Math.sqrt(g.touchdownSpeed ** 2 + 2 * g.planFraction * aAvail * h)
            : -g.touchdownSpeed;
        if (vz < profile) {
          mode = 'landing';
          // Feed-forward: the constant deceleration that reaches touchdown speed at h = 0.
          const needed = (vz * vz - g.touchdownSpeed ** 2) / (2 * Math.max(h, 0.05));
          liftForce = (s.mass * (s.gravity + needed + g.vertical * (profile - vz))) / uy;
        }
      }
    } else {
      liftForce = cmd.lift * liftMax;
      if (cmd.lift > 0 && mode === 'manual') mode = 'lift';
    }
    liftForce = clamp(liftForce, 0, liftMax);

    const mix = mixLift(down, liftForce, torque[0], torque[2]);
    const downDuty = mix.forces.map((f, i) => {
      const t = down[i]!;
      return t.maxThrust > 0 ? clamp(f / t.maxThrust, 0, t.maxDuty) : 0;
    });

    // ---------------- yaw
    const yawDuty = yaw.map((t) => {
      const lever = cross(t.position, t.direction)[1];
      if (t.maxThrust <= 0 || lever === 0 || Math.sign(lever) !== Math.sign(torque[1])) return 0;
      return clamp(Math.abs(torque[1]) / (Math.abs(lever) * t.maxThrust), 0, t.maxDuty);
    });

    return {
      down: downDuty,
      yaw: yawDuty,
      mode,
      liftForce,
      torque,
      rollProgress: this.rollActive ? Math.min(1, this.rollDone / Math.PI) : 0,
    };
  }
}
