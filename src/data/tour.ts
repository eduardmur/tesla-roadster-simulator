/**
 * The guided tour: 6 chapters, each a few captions (never more than two sentences) on camera
 * rails, then a 20–40 s hands-on task. Text is CC BY 4.0 (see LICENSE-CONTENT.md).
 * Numbers never appear as literal text: {spec:id} renders a spec with its status and source,
 * {calc:name} renders a value our model derives from the specs (see src/data/derived.ts).
 */
import type { CameraShot } from '../scene/cameras/director';
import type { SpecId } from './specs';

export type TourSetup =
  'drag-tires' | 'tilt-rig' | 'tank-vent' | 'drag-thrust' | 'hop' | 'burn-all';

export type TourTask =
  'launch-tires' | 'tilt-ceiling' | 'vent-half' | 'launch-thrust' | 'hop-roll' | 'empty-tank';

export type TourPanel = 'tilt' | 'tanks' | 'nozzle' | 'grip' | 'underbody' | null;

export interface TourStep {
  text: string;
  /** Spec values shown under the caption. */
  specs?: SpecId[];
  shot: CameraShot;
  xray?: boolean;
}

export interface TourChapter {
  id: string;
  title: string;
  setup: TourSetup;
  steps: TourStep[];
  task: {
    id: TourTask;
    instruction: string;
    hint: string;
    seconds: number;
  };
  panel: TourPanel;
  /** Shown after the task. */
  takeaway: string;
}

export const TOUR: TourChapter[] = [
  {
    id: 'grip',
    title: '1 · The grip ceiling',
    setup: 'drag-tires',
    panel: 'grip',
    steps: [
      {
        text: 'A tire can only push on the road as hard as the road pushes back on it, times its grip. For these tires that tops out around {spec:tireOnlyGrip}.',
        shot: { kind: 'carFrame', offset: [5.5, 1.1, 2.5], look: [0, 0.2, 0.5], fov: 40 },
      },
      {
        text: 'Past that point, extra motor power just spins the wheels. So how do you launch harder than your tires allow?',
        shot: { kind: 'carFrame', offset: [-3, 0.6, 6.5], look: [0, 0.3, 0], fov: 45 },
      },
    ],
    task: {
      id: 'launch-tires',
      instruction: 'Launch with the fans and thrusters off: hold W until you reach 60 mph.',
      hint: 'Watch "tire use" hit 100 %: that is the grip ceiling.',
      seconds: 30,
    },
    takeaway:
      'Tires alone: about {calc:tiresOnly060} to 60 mph in our model, however much power you add.',
  },
  {
    id: 'suction',
    title: '2 · Sucked to the road',
    setup: 'tilt-rig',
    panel: 'tilt',
    steps: [
      {
        text: 'Fans under the car pump air out from beneath a skirted, sealed floor. The atmosphere then presses the whole car down: the reveal ramp showed {spec:invertedDownforce} of it.',
        specs: ['fanPatent'],
        shot: { kind: 'carFrame', offset: [6, -0.2, 3], look: [0, -0.3, 0], fov: 40 },
        xray: true,
      },
      {
        text: 'That needs only about {calc:suctionPercent} less pressure under the floor than outside. The trick is area, not a strong vacuum.',
        specs: ['floorArea'],
        shot: { kind: 'carFrame', offset: [0, -1.4, 5.5], look: [0, -0.4, 0], fov: 50 },
        xray: true,
      },
    ],
    task: {
      id: 'tilt-ceiling',
      instruction:
        'Tilt the road with the slider until the car hangs from a wall, then from the ceiling.',
      hint: 'Downforce follows the car’s own floor, so it works on any surface. Try switching the fans off at 90°.',
      seconds: 40,
    },
    takeaway:
      'Suction acts along the car’s own “down”, toward whatever surface the skirts seal against.',
  },
  {
    id: 'tank',
    title: '3 · A tank of air',
    setup: 'tank-vent',
    panel: 'tanks',
    steps: [
      {
        text: 'The thrust comes from air stored at {spec:thrusterPressure}. In the Rocket, {spec:airVolumeTotal} of tanks hold {spec:airMass} of it.',
        shot: { kind: 'carFrame', offset: [3.2, 1.6, -0.6], look: [0, 0.1, -0.5], fov: 40 },
        xray: true,
      },
      {
        text: 'Nothing tops it up on the move: every second of thrust drains it. The gas left inside does work pushing the rest out, so it gets very cold.',
        shot: { kind: 'carFrame', offset: [-3.5, 1.2, -2.5], look: [0, 0.1, -0.6], fov: 42 },
        xray: true,
      },
    ],
    task: {
      id: 'vent-half',
      instruction:
        'Vent the tank: hold Space and watch pressure and temperature fall. The brakes are on.',
      hint: 'Thrust falls with pressure. Try the “adiabatic” and “isothermal” buttons in the panel.',
      seconds: 30,
    },
    takeaway: 'Pressure falls faster than mass because the gas cools as it expands.',
  },
  {
    id: 'nozzle',
    title: '4 · How a nozzle makes thrust',
    setup: 'drag-thrust',
    panel: 'nozzle',
    steps: [
      {
        text: 'In each nozzle’s narrow throat the air reaches the speed of sound. The bell after it accelerates it to about Mach {calc:exitMach} and roughly {calc:exhaustVelocity}.',
        shot: { kind: 'carFrame', offset: [0.9, 0.05, -4.4], look: [0, -0.15, -2.1], fov: 34 },
      },
      {
        text: 'Thrust is mass flow times exit speed, plus a pressure bonus at the exit. Four of these make {spec:rearThrustTotal}, and none of it goes through the tires.',
        shot: { kind: 'carFrame', offset: [-2.2, 0.5, -6], look: [0, 0, -1.5], fov: 42 },
      },
    ],
    task: {
      id: 'launch-thrust',
      instruction: 'Launch with 80 kN: hold W and Space until 60 mph.',
      hint: 'Compare your time with the claims in the result.',
      seconds: 30,
    },
    takeaway: 'Thrust bypasses the grip ceiling entirely: that is how 0–60 drops below a second.',
  },
  {
    id: 'hop',
    title: '5 · The hop',
    setup: 'hop',
    panel: null,
    steps: [
      {
        text: 'The Rocket adds {spec:downNozzleCount} nozzles pointing down and {spec:yawNozzleCount} at the nose pointing sideways. A flight computer pulses them to lift, pitch, roll and yaw.',
        specs: ['flightActuators'],
        shot: { kind: 'carFrame', offset: [5.5, 1.5, 4.5], look: [0, -0.2, 0], fov: 42 },
        xray: true,
      },
      {
        text: 'Hovering a {spec:vehicleMass} car takes about {calc:hoverThrust}, which burns roughly {calc:hoverFlow} of air. That is why it hops instead of flying.',
        shot: { kind: 'orbit', radius: 9, height: 2.5, speed: 0.15, fov: 42 },
      },
    ],
    task: {
      id: 'hop-roll',
      instruction:
        'Hold Shift to hop, then press R in the air for a 180° roll. Auto-level brings you back for the landing.',
      hint: 'Keep it short: hovering costs about {calc:hoverFlow} of air.',
      seconds: 40,
    },
    takeaway:
      'Rolling is easy: the car spins far more easily about its long axis than end over end.',
  },
  {
    id: 'limits',
    title: '6 · The limits',
    setup: 'burn-all',
    panel: null,
    steps: [
      {
        text: 'A full fill buys {spec:cellcogFullThrust} of full thrust (our model: {calc:fullThrustSeconds}). Refilling from a nitrogen supply takes {spec:refillHoursMin} to {spec:refillHoursMax}, though Musk says the car refills itself.',
        shot: { kind: 'carFrame', offset: [4.5, 1.3, 4], look: [0, 0.2, 0], fov: 42 },
      },
      {
        text: 'The Rocket is invite-only and not approved for public roads. At {spec:rocketAccelG}, launches are hard on bodies too.',
        specs: ['rocketAccess'],
        shot: { kind: 'carFrame', offset: [-4.5, 1, 5], look: [0, 0.2, 0], fov: 42 },
      },
    ],
    task: {
      id: 'empty-tank',
      instruction: 'Burn it all: hold W and Space until the tank is empty. How long did it last?',
      hint: 'Watch “air left” count down.',
      seconds: 30,
    },
    takeaway: 'Now try the ramp.',
  },
];
