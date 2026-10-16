import { describe, expect, it } from 'vitest';
import {
  DOWN_NOZZLES,
  FlightComputer,
  YAW_NOZZLES,
  add,
  cross,
  integrateOrientation,
  mixLift,
  quatFromAxisAngle,
  rotate,
  scale,
  toBody,
  type FlightAssists,
  type FlightCommand,
  type FlightThruster,
  type Quat,
  type V3,
} from '../../src/physics';

const g = 9.80665;
const mass = 2350;
const inertia: V3 = [3000, 3500, 820];
const down: FlightThruster[] = DOWN_NOZZLES.map((n) => ({
  position: n.position,
  direction: n.direction,
  maxThrust: 19_000,
  maxDuty: 1,
}));
const yaw: FlightThruster[] = YAW_NOZZLES.map((n) => ({
  position: n.position,
  direction: n.direction,
  maxThrust: 2_500,
  maxDuty: 1,
}));
const ASSISTS: FlightAssists = { autoLevel: true, landingAssist: true };
const NO_INPUT: FlightCommand = { pitch: 0, roll: 0, yaw: 0, lift: 0 };

interface Body {
  pos: V3;
  vel: V3;
  q: Quat;
  w: V3;
  impulse: number;
  touchdownSpeed: number | null;
}

/** Minimal rigid-body integrator for testing the controller in isolation. */
function fly(
  body: Body,
  seconds: number,
  cmd: FlightCommand = NO_INPUT,
  assists = ASSISTS,
  fc = new FlightComputer(),
  onStep?: (fc: FlightComputer, t: number) => void,
): Body {
  const dt = 1 / 120;
  for (let t = 0; t < seconds; t += dt) {
    onStep?.(fc, t);
    const height = body.pos[1] - 0.46;
    const out = fc.update(
      dt,
      {
        orientation: body.q,
        angularVelocity: body.w,
        velocity: body.vel,
        heightAboveGround: height,
        airborne: height > 0.01,
        mass,
        gravity: g,
        inertia,
      },
      cmd,
      assists,
      down,
      yaw,
    );
    let force: V3 = [0, 0, 0];
    let torque: V3 = [0, 0, 0];
    const all = [
      ...down.map((d, i) => [d, out.down[i]!] as const),
      ...yaw.map((d, i) => [d, out.yaw[i]!] as const),
    ];
    for (const [th, duty] of all) {
      const f = scale(th.direction, th.maxThrust * duty);
      force = add(force, f);
      torque = add(torque, cross(th.position, f));
      body.impulse += th.maxThrust * duty * dt;
    }
    const acc = add(scale(rotate(body.q, force), 1 / mass), [0, -g, 0]);
    body.vel = add(body.vel, scale(acc, dt));
    body.pos = add(body.pos, scale(body.vel, dt));
    // Euler: I·ω̇ = τ − ω × (I·ω)
    const Iw: V3 = [inertia[0] * body.w[0], inertia[1] * body.w[1], inertia[2] * body.w[2]];
    const gyro = cross(body.w, Iw);
    body.w = [
      body.w[0] + ((torque[0] - gyro[0]) / inertia[0]) * dt,
      body.w[1] + ((torque[1] - gyro[1]) / inertia[1]) * dt,
      body.w[2] + ((torque[2] - gyro[2]) / inertia[2]) * dt,
    ];
    body.q = integrateOrientation(body.q, body.w, dt);
    if (body.pos[1] <= 0.46) {
      body.touchdownSpeed ??= -body.vel[1];
      break;
    }
  }
  return body;
}

const start = (q: Quat, y = 25): Body => ({
  pos: [0, y, 0],
  vel: [0, 0, 0],
  q,
  w: [0, 0, 0],
  impulse: 0,
  touchdownSpeed: null,
});

const upY = (b: Body) => toBody(b.q, [0, 1, 0])[1];

describe('mixer', () => {
  it('delivers a pure roll torque with non-negative nozzle forces', () => {
    const tau = 10_000;
    const { forces } = mixLift(down, 0, 0, tau);
    let tz = 0;
    forces.forEach((f, i) => {
      expect(f).toBeGreaterThanOrEqual(0);
      tz += cross(down[i]!.position, scale(down[i]!.direction, f))[2];
    });
    expect(tz).toBeCloseTo(tau, 3);
  });

  it('gives torque priority over lift when saturated', () => {
    const { forces, torqueScale } = mixLift(down, 200_000, 0, 30_000);
    expect(torqueScale).toBeGreaterThan(0.99);
    for (const f of forces) expect(f).toBeLessThanOrEqual(19_000 + 1e-6);
  });
});

describe('flight computer', () => {
  it('roll-180 assist flips an inverted car upright in under 1.2 s', () => {
    const inverted = quatFromAxisAngle([0, 0, 1], Math.PI);
    const fc = new FlightComputer();
    fc.requestRoll180(1);
    const b = fly(start(inverted), 1.2, NO_INPUT, { autoLevel: false, landingAssist: false }, fc);
    expect(upY(b)).toBeGreaterThan(0.95);
  });

  it('auto-level recovers from the curl exit (pitched 170°) by rolling', () => {
    const exit = quatFromAxisAngle([1, 0, 0], (170 * Math.PI) / 180);
    const b = fly(start(exit), 1.6);
    expect(upY(b)).toBeGreaterThan(0.97);
  });

  it('landing assist brings a 15 m drop down at a walking pace', () => {
    const b = fly(start([0, 0, 0, 1], 15.46), 10);
    expect(b.touchdownSpeed).not.toBeNull();
    expect(b.touchdownSpeed!).toBeLessThan(3);
    // Impulse spent should be far less than hovering the whole way down.
    expect(b.impulse).toBeLessThan(mass * g * 4);
  });

  it('hard mode (no assists) does nothing without input', () => {
    const b = fly(start([0, 0, 0, 1], 5.46), 2, NO_INPUT, {
      autoLevel: false,
      landingAssist: false,
    });
    expect(b.impulse).toBeLessThan(1);
  });

  it('with assist, lift input climbs and releasing it still lands softly', () => {
    const fc = new FlightComputer();
    const b = fly(start([0, 0, 0, 1], 0.47), 1.0, { ...NO_INPUT, lift: 1 }, ASSISTS, fc);
    expect(b.pos[1]).toBeGreaterThan(1.5);
    const landed = fly(b, 10, NO_INPUT, ASSISTS, fc);
    expect(landed.touchdownSpeed!).toBeLessThan(3);
  });
});
