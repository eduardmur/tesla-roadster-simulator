/**
 * Suction, thruster and aero forces, computed by the pure physics module and applied to the
 * Rapier body as impulses at the right points every fixed step.
 */
import type RAPIER from '@dimforge/rapier3d-compat';
import { SPECS } from '../data/specs';
import { SKIRT_PROBES, type NozzleLayout } from '../physics/layout';
import { add, length, rotate, scale, type V3 } from '../physics/math';
import { nozzlePerformance, pwmIsOpen, pwmOpenFraction, type NozzleState } from '../physics/nozzle';
import { KMH, type ThrusterGroup, type ThrusterKind, type VehicleParams } from '../physics/params';
import {
  effectiveGap,
  stepSuction,
  OPEN_GAP,
  type SuctionOutput,
  type SuctionState,
} from '../physics/suction';
import { stepTank, type TankState } from '../physics/tank';
import type { FanMode } from './types';
import { rv, type Pose, type Rapier } from './vehicle';

export const PROBE_RAY = 0.9;

export interface SuctionRuntime {
  state: SuctionState;
  out: SuctionOutput | null;
  probeGaps: number[];
  /** Centre of pressure on the floor, body frame. */
  centre: V3;
  mode: FanMode;
}

export function createSuction(): SuctionRuntime {
  return {
    state: { fanSpeed: 0, deltaP: 0 },
    out: null,
    probeGaps: SKIRT_PROBES.map(() => OPEN_GAP),
    centre: [0, -0.36, 0],
    mode: 'off',
  };
}

export interface ForceContext {
  R: Rapier;
  world: RAPIER.World;
  body: RAPIER.RigidBody;
  params: VehicleParams;
  pose: Pose;
  dt: number;
  time: number;
}

export function stepSuctionForce(ctx: ForceContext, rt: SuctionRuntime, fansOn: boolean): void {
  const { R, world, body, params, pose, dt } = ctx;
  const down = scale(pose.up, -1);
  const distances: number[] = [];
  for (const p of SKIRT_PROBES) {
    const origin = add(pose.pos, rotate(pose.rot, p));
    const hit = world.castRay(
      new R.Ray(rv(origin), rv(down)),
      PROBE_RAY,
      true,
      undefined,
      undefined,
      undefined,
      body,
    );
    distances.push(hit ? hit.timeOfImpact : Infinity);
  }
  const cfg = params.suction;
  const gap = effectiveGap(cfg, distances);
  rt.probeGaps = distances.map((d) =>
    Number.isFinite(d)
      ? Math.min(Math.max(d - cfg.skirtReach, 0), OPEN_GAP) + cfg.residualGap
      : OPEN_GAP,
  );

  const out = stepSuction(
    cfg,
    rt.state,
    fansOn && params.hasFans ? 1 : 0,
    gap,
    params.env.ambientPressure,
    params.env.ambientTemperature,
    dt,
  );
  rt.state = { fanSpeed: out.fanSpeed, deltaP: out.deltaP };
  rt.out = out;
  const speed = length(pose.linvel);
  rt.mode =
    out.fanSpeed < 0.05
      ? 'off'
      : speed > SPECS.highSpeedModeSpeed.value * KMH
        ? 'high-speed'
        : 'suction';

  // Centre of pressure shifts toward the well-sealed part of the floor.
  let wsum = 0;
  let cx = 0;
  let cz = 0;
  SKIRT_PROBES.forEach((p, i) => {
    const g = rt.probeGaps[i]! / cfg.residualGap;
    const w = 1 / (1 + (g - 1) * (g - 1));
    wsum += w;
    cx += w * p[0];
    cz += w * p[2];
  });
  rt.centre = wsum > 0 ? [cx / wsum, -0.36, cz / wsum] : [0, -0.36, 0];

  if (out.downforce > 0) {
    const at = add(pose.pos, rotate(pose.rot, rt.centre));
    body.applyImpulseAtPoint(rv(scale(down, out.downforce * dt)), rv(at), true);
  }
}

export interface NozzleRuntime {
  layout: NozzleLayout;
  kind: ThrusterKind;
  group: ThrusterGroup;
  phase: number;
  duty: number;
  open: boolean;
  thrust: number;
  available: number;
}

export function createNozzles(params: VehicleParams): NozzleRuntime[] {
  const out: NozzleRuntime[] = [];
  for (const g of params.thrusters) {
    g.nozzles.forEach((layout, i) => {
      out.push({
        layout,
        kind: g.kind,
        group: g,
        // Stagger the valves so they don't all open at the same instant.
        phase: (i / g.nozzles.length) * params.pwmPeriod,
        duty: 0,
        open: false,
        thrust: 0,
        available: 0,
      });
    });
  }
  return out;
}

export interface ThrustResult {
  massFlow: number;
  rear: number;
  lift: number;
  yaw: number;
  rearState: NozzleState | null;
}

/** Group performance at the current tank state (same for every nozzle of a group). */
export function groupPerformance(
  params: VehicleParams,
  tank: TankState | null,
  group: ThrusterGroup,
): NozzleState | null {
  if (!tank) return null;
  return nozzlePerformance(
    group.geometry,
    params.gas,
    tank.pressure,
    tank.temperature,
    params.env.ambientPressure,
  );
}

/**
 * Fire the nozzles at their commanded duties (already set on each runtime), integrate the
 * exact PWM open time, apply the forces and drain the tank. Returns the new tank state.
 */
export function stepThrusters(
  ctx: ForceContext,
  nozzles: NozzleRuntime[],
  tank: TankState | null,
  result: ThrustResult,
): TankState | null {
  const { params, pose, body, dt, time } = ctx;
  result.massFlow = 0;
  result.rear = 0;
  result.lift = 0;
  result.yaw = 0;
  result.rearState = null;
  if (!tank || !params.tank) {
    for (const n of nozzles) {
      n.thrust = 0;
      n.open = false;
      n.available = 0;
    }
    return tank;
  }
  const perf = new Map<ThrusterGroup, NozzleState>();
  for (const g of params.thrusters) {
    const p = groupPerformance(params, tank, g);
    if (p) perf.set(g, p);
    if (g.kind === 'rear') result.rearState = p;
  }
  for (const n of nozzles) {
    const p = perf.get(n.group);
    n.available = p?.thrust ?? 0;
    if (!p || p.thrust <= 0 || n.duty <= 0) {
      n.thrust = 0;
      n.open = false;
      continue;
    }
    const frac = pwmOpenFraction(time + n.phase, dt, params.pwmPeriod, n.duty);
    n.open = pwmIsOpen(time + dt + n.phase, params.pwmPeriod, n.duty);
    n.thrust = p.thrust * frac;
    result.massFlow += p.massFlow * frac;
    if (n.kind === 'rear') result.rear += n.thrust;
    else if (n.kind === 'down') result.lift += n.thrust;
    else result.yaw += n.thrust;
    if (n.thrust > 0) {
      const dir = rotate(pose.rot, n.layout.direction);
      const at = add(pose.pos, rotate(pose.rot, n.layout.position));
      body.applyImpulseAtPoint(rv(scale(dir, n.thrust * dt)), rv(at), true);
    }
  }
  return stepTank(tank, params.tank, result.massFlow, dt);
}

export function applyDrag(ctx: ForceContext): number {
  const { params, pose, body, dt } = ctx;
  const v = pose.linvel;
  const speed = length(v);
  if (speed < 0.01) return 0;
  const f = 0.5 * params.env.airDensity * params.dragArea * speed;
  body.applyImpulse(rv(scale(v, -f * dt)), true);
  return f * speed;
}
