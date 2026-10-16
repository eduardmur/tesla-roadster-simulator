/**
 * The simulation world: Rapier colliders for the ground and the curl ramp, the car, and a
 * deterministic fixed-step loop (120 Hz).
 *
 * Rendering never writes to the sim; it reads poses and telemetry.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { BODY } from '../physics/layout';
import { FlightComputer, type FlightAssists, type FlightThruster } from '../physics/flightComputer';
import {
  add,
  dot,
  length,
  quatFromAxisAngle,
  rotate,
  scale,
  sub,
  toBody,
  type Quat,
  type V3,
} from '../physics/math';
import {
  buildVehicleParams,
  reportedWhatIf,
  type TrimId,
  type VehicleParams,
  type WhatIf,
} from '../physics/params';
import { tankFraction, type TankState } from '../physics/tank';
import {
  applyDrag,
  createNozzles,
  createSuction,
  stepSuctionForce,
  stepThrusters,
  type NozzleRuntime,
  type SuctionRuntime,
  type ThrustResult,
} from './forces';
import { RAMP, SPAWNS, curlSurface, type Spawn, type SpawnId } from './track';
import { NO_INPUT, emptyTelemetry, type DriveInput, type Telemetry } from './types';
import { createWheels, readPose, rv, stepWheels, type Pose, type WheelRuntime } from './vehicle';

export const FIXED_DT = 1 / 120;
const MAX_STEPS_PER_FRAME = 12;

export interface StepInfo {
  pose: Pose;
  airborne: boolean;
  wheelContacts: number;
  /** Specific force in the body frame, m/s² (unfiltered). */
  specific: V3;
  /** Surfaces the chassis (not the wheels) is touching this step. */
  chassisTouching: string[];
  surface: string;
}

export type StepListener = (sim: Sim, info: StepInfo) => void;

let rapierReady: Promise<void> | null = null;

/** Load the Rapier WASM once. */
export function loadRapier(): Promise<void> {
  rapierReady ??= RAPIER.init();
  return rapierReady;
}

export class Sim {
  readonly R = RAPIER;
  readonly world: RAPIER.World;
  readonly body: RAPIER.RigidBody;
  readonly chassis: RAPIER.Collider[] = [];
  readonly labels = new Map<number, string>();
  readonly platforms = new Map<string, RAPIER.RigidBody>();

  params!: VehicleParams;
  nozzles: NozzleRuntime[] = [];
  wheels: WheelRuntime[] = createWheels();
  suction: SuctionRuntime = createSuction();
  tank: TankState | null = null;
  readonly fc = new FlightComputer();
  private steer = { value: 0 };

  input: DriveInput = { ...NO_INPUT };
  assists: FlightAssists = { autoLevel: true, landingAssist: true };
  fansOn = true;
  /** Launch control: fire the rear thrusters automatically until this speed (m/s). */
  autoThrustUntil: number | null = null;
  holdBrake = false;

  time = 0;
  stepIndex = 0;
  timeScale = 1;
  paused = false;
  private accumulator = 0;
  private airborneTime = 0;
  private prevRollRequest = false;
  private lastVel: V3 = [0, 0, 0];
  private gFiltered: V3 = [0, 9.81, 0];
  private thrust: ThrustResult = { massFlow: 0, rear: 0, lift: 0, yaw: 0, rearState: null };
  private flightMode: Telemetry['flightMode'] = 'idle';
  private rollProgress = 0;
  private lastWheel = {
    contacts: 0,
    gripLimit: 0,
    tireForce: [0, 0, 0] as V3,
    maxUtilization: 0,
    surface: '',
  };
  private altitude = 0;
  private prevPose: { pos: V3; rot: Quat } | null = null;

  readonly telemetry: Telemetry = emptyTelemetry();
  readonly listeners = new Set<StepListener>();
  lastInfo: StepInfo | null = null;

  /** Call `await loadRapier()` first. */
  constructor(trim: TrimId = 'rocket', whatIf: WhatIf = reportedWhatIf()) {
    const R = RAPIER;
    this.world = new R.World({ x: 0, y: -whatIf.gravity, z: 0 });
    this.world.timestep = FIXED_DT;

    const ground = this.world.createCollider(
      R.ColliderDesc.cuboid(1500, 1, 1500).setTranslation(0, -1, 0).setFriction(1),
    );
    this.labels.set(ground.handle, 'ground');

    const m = curlSurface(RAMP);
    const ramp = this.world.createCollider(
      R.ColliderDesc.trimesh(m.positions, m.indices).setFriction(1),
    );
    this.labels.set(ramp.handle, 'curl');

    this.body = this.world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(0, BODY.comHeight, 0)
        .setCcdEnabled(true)
        .setAngularDamping(0.05),
    );
    const hull = this.world.createCollider(
      R.ColliderDesc.cuboid(0.92, 0.22, 1.7)
        .setTranslation(0, -0.06, 0)
        .setDensity(0)
        .setFriction(0.5)
        .setRestitution(0.05),
      this.body,
    );
    const cabin = this.world.createCollider(
      R.ColliderDesc.cuboid(0.7, 0.2, 0.95)
        .setTranslation(0, 0.38, -0.15)
        .setDensity(0)
        .setFriction(0.5)
        .setRestitution(0.05),
      this.body,
    );
    this.chassis.push(hull, cabin);

    this.setVehicle(trim, whatIf);
    this.reset('start');
  }

  /** Rebuild the vehicle for a trim / what-if set. Refills the tank. */
  setVehicle(trim: TrimId, whatIf: WhatIf): void {
    this.params = buildVehicleParams(trim, whatIf);
    this.world.gravity = { x: 0, y: -whatIf.gravity, z: 0 };
    this.nozzles = createNozzles(this.params);
    this.refill();
  }

  refill(): void {
    this.tank = this.params.tankFull ? { ...this.params.tankFull } : null;
    this.updateMass();
  }

  get mass(): number {
    return this.params.dryMass + (this.tank?.mass ?? 0);
  }

  private updateMass(): void {
    const m = this.mass;
    const k = m / this.params.mass;
    const I = this.params.inertia;
    this.body.setAdditionalMassProperties(
      m,
      { x: 0, y: 0, z: 0 },
      { x: I[0] * k, y: I[1] * k, z: I[2] * k },
      { x: 0, y: 0, z: 0, w: 1 },
      true,
    );
  }

  /** Teleport to a spawn point at rest with full tanks. */
  reset(spawn: SpawnId | Spawn, keepTank = false): void {
    const s = typeof spawn === 'string' ? SPAWNS[spawn] : spawn;
    const q = quatFromAxisAngle([0, 1, 0], s.yaw);
    const up = rotate(q, [0, 1, 0]);
    const pos = add(s.position, scale(up, BODY.comHeight + 0.02));
    this.body.setTranslation(rv(pos), true);
    this.body.setRotation({ x: q[0], y: q[1], z: q[2], w: q[3] }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    if (!keepTank) this.refill();
    this.suction = createSuction();
    this.wheels = createWheels();
    this.steer.value = 0;
    this.fc.reset();
    this.airborneTime = 0;
    this.lastVel = [0, 0, 0];
    this.gFiltered = [0, this.params.env.gravity, 0];
    this.autoThrustUntil = null;
    this.holdBrake = false;
    this.input = { ...NO_INPUT };
    this.prevPose = null;
    this.updateTelemetry();
  }

  /** Advance by real time (seconds). Returns the number of fixed steps taken. */
  advance(realDt: number): number {
    if (this.paused) {
      this.updateTelemetry();
      return 0;
    }
    this.accumulator += Math.min(realDt, 0.1) * this.timeScale;
    let n = 0;
    while (this.accumulator >= FIXED_DT && n < MAX_STEPS_PER_FRAME) {
      this.step();
      this.accumulator -= FIXED_DT;
      n++;
    }
    if (n === MAX_STEPS_PER_FRAME) this.accumulator = 0;
    this.updateTelemetry();
    return n;
  }

  /** Interpolation factor between the last two steps, for smooth slow motion. */
  get alpha(): number {
    return this.paused ? 1 : Math.min(this.accumulator / FIXED_DT, 1);
  }

  /** Pose to render this frame, interpolated between the last two physics steps. */
  renderPose(): { pos: V3; rot: Quat } {
    const t = this.body.translation();
    const r = this.body.rotation();
    const cur = { pos: [t.x, t.y, t.z] as V3, rot: [r.x, r.y, r.z, r.w] as Quat };
    const prev = this.prevPose;
    if (!prev) return cur;
    const a = this.alpha;
    const d =
      prev.rot[0] * cur.rot[0] +
      prev.rot[1] * cur.rot[1] +
      prev.rot[2] * cur.rot[2] +
      prev.rot[3] * cur.rot[3];
    const sign = d < 0 ? -1 : 1;
    const rot: Quat = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) rot[i] = prev.rot[i]! * (1 - a) + cur.rot[i]! * sign * a;
    const l = Math.hypot(...rot) || 1;
    return {
      pos: [
        prev.pos[0] + (cur.pos[0] - prev.pos[0]) * a,
        prev.pos[1] + (cur.pos[1] - prev.pos[1]) * a,
        prev.pos[2] + (cur.pos[2] - prev.pos[2]) * a,
      ],
      rot: [rot[0]! / l, rot[1]! / l, rot[2]! / l, rot[3]! / l],
    };
  }

  /** One fixed physics step. */
  step(): void {
    const dt = FIXED_DT;
    const pose = readPose(this.body);
    this.prevPose = { pos: pose.pos, rot: pose.rot };
    const mass = this.mass;
    const params = this.params;

    const wr = stepWheels(
      {
        R: this.R,
        world: this.world,
        body: this.body,
        params,
        pose,
        input: this.input,
        dt,
        mass,
        labels: this.labels,
        holdBrake: this.holdBrake,
        platforms: this.platforms,
      },
      this.wheels,
      this.steer,
    );
    this.lastWheel = wr;
    this.airborneTime = wr.contacts === 0 ? this.airborneTime + dt : 0;
    const airborne = this.airborneTime > 0.08;

    const ctx = {
      R: this.R,
      world: this.world,
      body: this.body,
      params,
      pose,
      dt,
      time: this.time,
    };
    stepSuctionForce(ctx, this.suction, this.fansOn);

    // Altitude above whatever is below (for the landing assist and the HUD).
    const hit = this.world.castRay(
      new this.R.Ray(rv(pose.pos), { x: 0, y: -1, z: 0 }),
      400,
      true,
      undefined,
      undefined,
      undefined,
      this.body,
    );
    this.altitude = hit ? hit.timeOfImpact - BODY.comHeight : Infinity;

    this.commandNozzles(pose, airborne, mass, dt);
    this.tank = stepThrusters(ctx, this.nozzles, this.tank, this.thrust);
    applyDrag(ctx);

    this.world.step();
    this.time += dt;
    this.stepIndex++;
    if (this.stepIndex % 12 === 0) this.updateMass();

    // Accelerometer: specific force = a − g, in the body frame.
    const v = [this.body.linvel().x, this.body.linvel().y, this.body.linvel().z] as V3;
    const a = scale(sub(v, this.lastVel), 1 / dt);
    this.lastVel = v;
    const specificWorld = add(a, [0, this.params.env.gravity, 0]);
    const newPose = readPose(this.body);
    const specific = toBody(newPose.rot, specificWorld);
    const k = 0.15;
    this.gFiltered = [
      this.gFiltered[0] + (specific[0] - this.gFiltered[0]) * k,
      this.gFiltered[1] + (specific[1] - this.gFiltered[1]) * k,
      this.gFiltered[2] + (specific[2] - this.gFiltered[2]) * k,
    ];

    if (this.listeners.size > 0) {
      const info: StepInfo = {
        pose: newPose,
        airborne,
        wheelContacts: wr.contacts,
        specific,
        chassisTouching: this.chassisTouching(),
        surface: wr.surface,
      };
      this.lastInfo = info;
      for (const l of this.listeners) l(this, info);
    }
  }

  private commandNozzles(pose: Pose, airborne: boolean, mass: number, dt: number): void {
    const p = this.params;
    const fwd = dot(pose.linvel, pose.forward);
    const launch =
      this.autoThrustUntil !== null && this.input.throttle > 0 && fwd < this.autoThrustUntil;
    const rearCmd = Math.max(this.input.thrust, launch ? 1 : 0);
    for (const n of this.nozzles) if (n.kind === 'rear') n.duty = rearCmd * n.group.maxDuty;

    const down = this.nozzles.filter((n) => n.kind === 'down');
    const yaw = this.nozzles.filter((n) => n.kind === 'yaw');
    if (down.length === 0 && yaw.length === 0) {
      this.flightMode = 'idle';
      return;
    }
    if (this.input.roll180 && !this.prevRollRequest && airborne) {
      this.fc.requestRoll180(this.input.roll < -0.1 ? -1 : 1);
    }
    this.prevRollRequest = this.input.roll180;
    const toThruster = (n: NozzleRuntime): FlightThruster => ({
      position: n.layout.position,
      direction: n.layout.direction,
      maxThrust: n.available,
      maxDuty: n.group.maxDuty,
    });
    const out = this.fc.update(
      dt,
      {
        orientation: pose.rot,
        angularVelocity: toBody(pose.rot, pose.angvel),
        velocity: pose.linvel,
        heightAboveGround: this.altitude,
        airborne,
        mass,
        gravity: p.env.gravity,
        inertia: [
          p.inertia[0] * (mass / p.mass),
          p.inertia[1] * (mass / p.mass),
          p.inertia[2] * (mass / p.mass),
        ],
      },
      {
        pitch: airborne ? this.input.pitch : 0,
        roll: airborne ? this.input.roll : 0,
        yaw: this.input.yaw,
        lift: this.input.lift,
      },
      this.assists,
      down.map(toThruster),
      yaw.map(toThruster),
    );
    down.forEach((n, i) => (n.duty = out.down[i] ?? 0));
    yaw.forEach((n, i) => (n.duty = out.yaw[i] ?? 0));
    this.flightMode = out.mode;
    this.rollProgress = out.rollProgress;
  }

  /** Labels of the colliders the chassis (not the wheels) is touching. */
  chassisTouching(): string[] {
    const out: string[] = [];
    for (const c of this.chassis) {
      this.world.contactPairsWith(c, (other) => {
        this.world.contactPair(c, other, (manifold) => {
          if (manifold.numContacts() > 0) {
            const label = this.labels.get(other.handle) ?? 'unknown';
            if (!out.includes(label)) out.push(label);
          }
        });
      });
    }
    return out;
  }

  /** Refresh the telemetry object in place (cheap; called once per frame). */
  updateTelemetry(): void {
    const t = this.telemetry;
    const pose = readPose(this.body);
    const g = this.params.env.gravity;
    t.time = this.time;
    t.position = pose.pos;
    t.orientation = pose.rot;
    t.velocity = pose.linvel;
    t.speed = length(pose.linvel);
    t.forwardSpeed = dot(pose.linvel, pose.forward);
    t.gLong = this.gFiltered[2] / g;
    t.gLat = this.gFiltered[0] / g;
    t.gVert = this.gFiltered[1] / g;
    t.gTotal = Math.hypot(...this.gFiltered) / g;
    t.mass = this.mass;

    const tank = this.tank;
    t.hasTank = !!tank;
    t.tankPressure = tank?.pressure ?? 0;
    t.tankTemperature = tank?.temperature ?? this.params.env.ambientTemperature;
    t.tankMass = tank?.mass ?? 0;
    t.tankFraction = tank && this.params.tankFull ? tankFraction(tank, this.params.tankFull) : 0;
    t.massFlow = this.thrust.massFlow;
    t.airLeftSeconds =
      tank && this.thrust.massFlow > 0.01 ? tank.mass / this.thrust.massFlow : Infinity;
    const rs = this.thrust.rearState;
    const rearCount = this.nozzles.filter((n) => n.kind === 'rear').length;
    t.airLeftFullThrust = tank && rs && rs.massFlow > 0 ? tank.mass / (rs.massFlow * rearCount) : 0;
    t.rearRegime = rs?.regime ?? 'off';

    if (t.nozzles.length !== this.nozzles.length) {
      t.nozzles = this.nozzles.map((n) => ({
        id: n.layout.id,
        kind: n.kind,
        label: n.layout.label,
        duty: 0,
        open: false,
        thrust: 0,
        available: 0,
      }));
    }
    this.nozzles.forEach((n, i) => {
      const nt = t.nozzles[i]!;
      nt.id = n.layout.id;
      nt.kind = n.kind;
      nt.label = n.layout.label;
      nt.duty = n.duty;
      nt.open = n.open;
      nt.thrust = n.thrust;
      nt.available = n.available;
    });
    t.rearThrust = this.thrust.rear;
    t.liftThrust = this.thrust.lift;
    t.yawThrust = this.thrust.yaw;

    const s = this.suction.out;
    t.fanMode = this.suction.mode;
    t.fanSpeed = s?.fanSpeed ?? 0;
    t.fanPower = s?.power ?? 0;
    t.deltaP = s?.deltaP ?? 0;
    t.downforce = s?.downforce ?? 0;
    t.sealEfficiency = s?.sealEfficiency ?? 0;
    t.gap = s?.gap ?? 0;
    t.probeGaps = this.suction.probeGaps;

    if (t.wheels.length !== 4) {
      t.wheels = this.wheels.map(() => ({
        contact: false,
        compression: 0,
        load: 0,
        utilization: 0,
        spin: 0,
        steer: 0,
        surface: '',
      }));
    }
    this.wheels.forEach((w, i) => {
      const wt = t.wheels[i]!;
      wt.contact = w.contact;
      wt.compression = w.compression;
      wt.load = w.load;
      wt.utilization = w.utilization;
      wt.spin = w.spin;
      wt.steer = w.steer;
      wt.surface = w.surface;
    });
    t.wheelsInContact = this.lastWheel.contacts;
    t.gripLimit = this.lastWheel.gripLimit;
    t.tireForce = length(this.lastWheel.tireForce);
    t.maxUtilization = this.lastWheel.maxUtilization;
    t.airborne = this.airborneTime > 0.08;
    t.altitude = this.altitude;
    t.flightMode = this.flightMode;
    t.rollProgress = this.rollProgress;
    t.upright = toBody(pose.rot, [0, 1, 0])[1];
    t.surface = this.lastWheel.surface || (t.airborne ? 'air' : 'ground');
  }

  dispose(): void {
    this.world.free();
  }
}
