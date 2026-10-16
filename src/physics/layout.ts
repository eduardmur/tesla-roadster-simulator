/**
 * Geometry of our procedural car, in the body frame used everywhere in the project:
 *   origin = centre of mass, +X = left, +Y = up, +Z = forward (metres).
 *
 * None of this is published. It is our model's layout, chosen to look like a low wedge
 * coupe and to place components where the reporting says they are.
 */
import type { V3 } from './math';

export const BODY = {
  length: 4.3,
  width: 2.0,
  height: 1.12,
  /** Height of the centre of mass above flat ground at static ride height. */
  comHeight: 0.46,
  /** Floor (skirt base) height above ground at static ride height. */
  floorClearance: 0.1,
};

export interface WheelLayout {
  id: 'FL' | 'FR' | 'RL' | 'RR';
  /** Suspension hard point (top of the strut), body frame. */
  anchor: V3;
  steer: boolean;
  driven: boolean;
}

export const WHEEL_RADIUS = 0.35;
export const SUSPENSION_REST = 0.24;
export const SUSPENSION_TRAVEL = 0.14;

const AXLE_FRONT = 1.36;
const AXLE_REAR = -1.4;
const HALF_TRACK = 0.84;
/** Anchor height above the COM. The wheel centre hangs SUSPENSION_REST below it at full droop. */
const ANCHOR_Y = 0.1;

export const WHEELS: WheelLayout[] = [
  { id: 'FL', anchor: [HALF_TRACK, ANCHOR_Y, AXLE_FRONT], steer: true, driven: true },
  { id: 'FR', anchor: [-HALF_TRACK, ANCHOR_Y, AXLE_FRONT], steer: true, driven: true },
  { id: 'RL', anchor: [HALF_TRACK, ANCHOR_Y, AXLE_REAR], steer: false, driven: true },
  { id: 'RR', anchor: [-HALF_TRACK, ANCHOR_Y, AXLE_REAR], steer: false, driven: true },
];

export interface NozzleLayout {
  id: string;
  label: string;
  position: V3;
  /** Direction of the force on the car (the jet leaves the opposite way). */
  direction: V3;
}

const DIFFUSER_Z = -2.08;
const DIFFUSER_Y = -0.12;

export const REAR_NOZZLES: NozzleLayout[] = [
  {
    id: 'R1',
    label: 'Rear thruster, outer left',
    position: [0.62, DIFFUSER_Y, DIFFUSER_Z],
    direction: [0, 0, 1],
  },
  {
    id: 'R2',
    label: 'Rear thruster, inner left',
    position: [0.22, DIFFUSER_Y, DIFFUSER_Z],
    direction: [0, 0, 1],
  },
  {
    id: 'R3',
    label: 'Rear thruster, inner right',
    position: [-0.22, DIFFUSER_Y, DIFFUSER_Z],
    direction: [0, 0, 1],
  },
  {
    id: 'R4',
    label: 'Rear thruster, outer right',
    position: [-0.62, DIFFUSER_Y, DIFFUSER_Z],
    direction: [0, 0, 1],
  },
];

const LIFT_X = 0.86;
const LIFT_Z = 1.72;
const LIFT_Y = -0.3;

export const DOWN_NOZZLES: NozzleLayout[] = [
  {
    id: 'D-FL',
    label: 'Lift nozzle, front left',
    position: [LIFT_X, LIFT_Y, LIFT_Z],
    direction: [0, 1, 0],
  },
  {
    id: 'D-FR',
    label: 'Lift nozzle, front right',
    position: [-LIFT_X, LIFT_Y, LIFT_Z],
    direction: [0, 1, 0],
  },
  {
    id: 'D-RL',
    label: 'Lift nozzle, rear left',
    position: [LIFT_X, LIFT_Y, -LIFT_Z],
    direction: [0, 1, 0],
  },
  {
    id: 'D-RR',
    label: 'Lift nozzle, rear right',
    position: [-LIFT_X, LIFT_Y, -LIFT_Z],
    direction: [0, 1, 0],
  },
];

const YAW_Z = 1.95;
const YAW_Y = -0.05;

export const YAW_NOZZLES: NozzleLayout[] = [
  // Jet exits to the right, pushing the nose left (+X force at the front → yaw left).
  {
    id: 'Y-L',
    label: 'Yaw nozzle, pushes nose left',
    position: [-0.72, YAW_Y, YAW_Z],
    direction: [1, 0, 0],
  },
  // Jet exits to the left, pushing the nose right.
  {
    id: 'Y-R',
    label: 'Yaw nozzle, pushes nose right',
    position: [0.72, YAW_Y, YAW_Z],
    direction: [-1, 0, 0],
  },
];

/** Skirt raycast origins on the floor (body frame), sampling the sealed rectangle's edge. */
export const SKIRT_PROBES: V3[] = [
  [0.78, -0.36, 1.2],
  [-0.78, -0.36, 1.2],
  [0.8, -0.36, 0],
  [-0.8, -0.36, 0],
  [0.78, -0.36, -1.2],
  [-0.78, -0.36, -1.2],
  [0, -0.36, 1.25],
  [0, -0.36, -1.25],
];

export const TANK_POSITIONS = {
  /** Main COPV, behind the seats. */
  main: [0, 0.02, -0.7] as V3,
  /** Rocket's second COPV, in place of the passenger seat. */
  passenger: [-0.42, -0.02, 0.25] as V3,
};

/** Principal moments of inertia (pitch about X, yaw about Y, roll about Z) for 2,350 kg. */
export const INERTIA_PER_2350: V3 = [3000, 3500, 820];
