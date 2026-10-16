/** Shared sim types: driver input and the live telemetry the UI reads. */
import type { FlightMode } from '../physics/flightComputer';
import type { FlowRegime } from '../physics/nozzle';
import type { ThrusterKind } from '../physics/params';
import type { Quat, V3 } from '../physics/math';

export interface DriveInput {
  /** 0..1 */
  throttle: number;
  /** 0..1 (also reverse when stopped) */
  brake: number;
  /** −1..1, + = left */
  steer: number;
  /** 0..1 rear thrusters */
  thrust: number;
  /** 0..1 Rocket lift */
  lift: number;
  /** −1..1 in the air: + = nose down */
  pitch: number;
  /** −1..1 in the air: + = roll right */
  roll: number;
  /** −1..1: + = nose left */
  yaw: number;
  /** Edge-triggered: request a 180° roll. */
  roll180: boolean;
}

export const NO_INPUT: DriveInput = {
  throttle: 0,
  brake: 0,
  steer: 0,
  thrust: 0,
  lift: 0,
  pitch: 0,
  roll: 0,
  yaw: 0,
  roll180: false,
};

export interface NozzleTelemetry {
  id: string;
  kind: ThrusterKind;
  label: string;
  /** Commanded average duty 0..1. */
  duty: number;
  /** Valve state right now. */
  open: boolean;
  /** Thrust averaged over the last step, N. */
  thrust: number;
  /** Thrust this nozzle would give at 100 % duty right now, N. */
  available: number;
}

export interface WheelTelemetry {
  contact: boolean;
  /** Suspension compression, m. */
  compression: number;
  /** Normal load, N. */
  load: number;
  /** Friction-circle utilisation (> 1 = sliding). */
  utilization: number;
  /** Wheel rotation angle, rad (visual). */
  spin: number;
  /** Steering angle, rad. */
  steer: number;
  surface: string;
}

export type FanMode = 'off' | 'suction' | 'high-speed';

export interface Telemetry {
  time: number;
  position: V3;
  orientation: Quat;
  velocity: V3;
  /** Speed, m/s. */
  speed: number;
  /** Forward speed (signed), m/s. */
  forwardSpeed: number;
  /** Specific force in the body frame (what an accelerometer reads), g. */
  gLong: number;
  gLat: number;
  gVert: number;
  gTotal: number;
  mass: number;

  hasTank: boolean;
  tankPressure: number;
  tankTemperature: number;
  tankMass: number;
  tankFraction: number;
  massFlow: number;
  /** Seconds of air left at the current consumption (Infinity when idle). */
  airLeftSeconds: number;
  /** Seconds of air left at full rear thrust. */
  airLeftFullThrust: number;
  rearRegime: FlowRegime;

  nozzles: NozzleTelemetry[];
  rearThrust: number;
  liftThrust: number;
  yawThrust: number;

  fanMode: FanMode;
  fanSpeed: number;
  fanPower: number;
  deltaP: number;
  downforce: number;
  sealEfficiency: number;
  gap: number;
  probeGaps: number[];

  wheels: WheelTelemetry[];
  wheelsInContact: number;
  /** Σ μ·N over wheels in contact, N. */
  gripLimit: number;
  /** |Σ tire force| in the road plane, N. */
  tireForce: number;
  /** Max friction-circle utilisation over the wheels. */
  maxUtilization: number;

  airborne: boolean;
  /** Height of the wheels above the ground below, m. */
  altitude: number;
  flightMode: FlightMode;
  rollProgress: number;
  /** World-up expressed in the body frame, y component (1 = upright, −1 = inverted). */
  upright: number;
  /** Name of the surface the car is on. */
  surface: string;
}

export function emptyTelemetry(): Telemetry {
  return {
    time: 0,
    position: [0, 0, 0],
    orientation: [0, 0, 0, 1],
    velocity: [0, 0, 0],
    speed: 0,
    forwardSpeed: 0,
    gLong: 0,
    gLat: 0,
    gVert: 1,
    gTotal: 1,
    mass: 0,
    hasTank: false,
    tankPressure: 0,
    tankTemperature: 293,
    tankMass: 0,
    tankFraction: 0,
    massFlow: 0,
    airLeftSeconds: Infinity,
    airLeftFullThrust: 0,
    rearRegime: 'off',
    nozzles: [],
    rearThrust: 0,
    liftThrust: 0,
    yawThrust: 0,
    fanMode: 'off',
    fanSpeed: 0,
    fanPower: 0,
    deltaP: 0,
    downforce: 0,
    sealEfficiency: 0,
    gap: 0,
    probeGaps: [],
    wheels: [],
    wheelsInContact: 0,
    gripLimit: 0,
    tireForce: 0,
    maxUtilization: 0,
    airborne: false,
    altitude: 0,
    flightMode: 'idle',
    rollProgress: 0,
    upright: 1,
    surface: 'ground',
  };
}
