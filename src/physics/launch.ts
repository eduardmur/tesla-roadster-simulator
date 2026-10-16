/**
 * Straight-line launch on level ground (1D), used for the 0–60 mph validation and the
 * drag-strip "claim ghost". Same models as the 3D sim: tire limit μ·(m·g + D), motor
 * force/power curve, thrust from the tank blowdown, aero drag and rolling resistance.
 */
import { nozzlePerformance } from './nozzle';
import { SIXTY_MPH, motorForce, thrusterGroup, type VehicleParams } from './params';
import { equilibriumSuction } from './suction';
import { stepTank, type TankState } from './tank';
import { gripLimit } from './tires';

export interface LaunchOptions {
  fans: boolean;
  /** Fire the rear thrusters at the trim's duty limit. */
  thrust: boolean;
  targetSpeed?: number;
  dt?: number;
  maxTime?: number;
  /** Record a trace sample every n steps (0 = none). */
  traceEvery?: number;
}

export interface LaunchSample {
  t: number;
  v: number;
  x: number;
  accelG: number;
  thrust: number;
  tireForce: number;
  tireLimit: number;
  tankPressure: number;
}

export interface LaunchResult {
  /** Time to reach the target speed, s (Infinity if never). */
  time: number;
  distance: number;
  peakG: number;
  averageG: number;
  airUsed: number;
  /** True if the tire limit, rather than the motors, capped tractive force at launch. */
  gripLimitedAtLaunch: boolean;
  trace: LaunchSample[];
}

export function simulateLaunch(params: VehicleParams, opts: LaunchOptions): LaunchResult {
  const target = opts.targetSpeed ?? SIXTY_MPH;
  const dt = opts.dt ?? 1 / 1000;
  const maxTime = opts.maxTime ?? 10;
  const { env } = params;
  const rear = opts.thrust ? thrusterGroup(params, 'rear') : undefined;

  let tank: TankState | null = params.tankFull ? { ...params.tankFull } : null;
  const startAir = tank?.mass ?? 0;
  const downforce = opts.fans
    ? equilibriumSuction(
        params.suction,
        params.suction.residualGap,
        1,
        env.airDensity,
        env.ambientPressure,
      ) * params.suction.floorArea
    : 0;

  let t = 0;
  let v = 0;
  let x = 0;
  let peakG = 0;
  let gripLimitedAtLaunch = false;
  const trace: LaunchSample[] = [];
  let step = 0;

  while (v < target && t < maxTime) {
    const mass = params.dryMass + (tank?.mass ?? 0);
    const normal = mass * env.gravity + downforce;
    const limit = gripLimit(params.mu, normal);
    const motor = motorForce(params, v);
    const tire = Math.min(motor, limit);
    if (step === 0) gripLimitedAtLaunch = limit < motor;

    let thrust = 0;
    if (rear && tank && params.tank) {
      const n = nozzlePerformance(
        rear.geometry,
        params.gas,
        tank.pressure,
        tank.temperature,
        env.ambientPressure,
      );
      const count = rear.nozzles.length;
      thrust = n.thrust * count * rear.maxDuty;
      const massFlow = n.massFlow * count * rear.maxDuty;
      tank = stepTank(tank, params.tank, massFlow, dt);
    }

    const drag = 0.5 * env.airDensity * params.dragArea * v * v;
    const rolling = params.rollingResistance * normal;
    const a = (tire + thrust - drag - rolling) / mass;
    v += a * dt;
    x += v * dt;
    t += dt;
    peakG = Math.max(peakG, a / env.gravity);

    if (opts.traceEvery && step % opts.traceEvery === 0) {
      trace.push({
        t,
        v,
        x,
        accelG: a / env.gravity,
        thrust,
        tireForce: tire,
        tireLimit: limit,
        tankPressure: tank?.pressure ?? 0,
      });
    }
    step++;
  }

  // With a 1 ms step the crossing time is accurate to well under 1 % of a 0.6 s run.
  const time = v >= target ? t : Infinity;
  return {
    time,
    distance: x,
    peakG,
    averageG: Number.isFinite(time) ? target / time / env.gravity : 0,
    airUsed: startAir - (tank?.mass ?? 0),
    gripLimitedAtLaunch,
    trace,
  };
}
