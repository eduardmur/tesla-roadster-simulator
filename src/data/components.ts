/**
 * Clickable components in X-ray / "Look inside" mode. Card text is CC BY 4.0 (see LICENSE-CONTENT.md).
 * Numbers are never written here: cards reference spec ids so status and source come along.
 */
import { DOWN_NOZZLES, REAR_NOZZLES, TANK_POSITIONS, WHEELS, YAW_NOZZLES } from '../physics/layout';
import type { V3 } from '../physics/math';
import type { TrimId } from '../physics/params';
import type { SpecId } from './specs';

export type ComponentGroup = 'thrust' | 'suction' | 'tank' | 'tire' | 'flight';

export type DemoAction =
  'rear-burst' | 'lift-burst' | 'yaw-burst' | 'fans' | 'pwm' | 'launch-tires' | 'roll' | 'skirts';

export interface CarComponent {
  id: string;
  label: string;
  group: ComponentGroup;
  position: V3;
  trims: TrimId[];
  what: string;
  specs: SpecId[];
  estimates: SpecId[];
  demo?: { action: DemoAction; label: string };
}

const ALL: TrimId[] = ['performance', 'thrust', 'rocket'];
const THRUST: TrimId[] = ['thrust', 'rocket'];
const ROCKET: TrimId[] = ['rocket'];

export const COMPONENTS: CarComponent[] = [
  {
    id: 'main-copv',
    label: 'Main air tank (COPV)',
    group: 'tank',
    position: [TANK_POSITIONS.main[0], TANK_POSITIONS.main[1] + 0.42, TANK_POSITIONS.main[2]],
    trims: THRUST,
    what: 'A carbon composite-overwrapped pressure vessel behind the seats stores air at very high pressure. Nothing burns: all the thrust comes from letting this air out.',
    specs: [
      'thrustTankVolume',
      'airMass',
      'thrusterPressure',
      'muskPressure',
      'tankLayout',
      'refillHoursMin',
      'refillHoursMax',
      'selfRefill',
    ],
    estimates: ['compressibility', 'tankHeatTransfer', 'ambientTemperature'],
    demo: { action: 'rear-burst', label: 'Vent through the rear nozzles' },
  },
  {
    id: 'passenger-copv',
    label: 'Second COPV (passenger seat)',
    group: 'tank',
    position: [
      TANK_POSITIONS.passenger[0],
      TANK_POSITIONS.passenger[1] + 0.4,
      TANK_POSITIONS.passenger[2],
    ],
    trims: ROCKET,
    what: 'The Rocket gives up its passenger seat for a second, larger vessel. That triples the air on board and makes it a single-seater.',
    specs: ['rocketSecondTank', 'airVolumeTotal', 'airMass', 'rocketSeats'],
    estimates: ['compressibility'],
    demo: { action: 'lift-burst', label: 'Use it: a short hop' },
  },
  {
    id: 'rear-thrusters',
    label: 'Rear main thrusters',
    group: 'thrust',
    position: [0, REAR_NOZZLES[0]!.position[1], REAR_NOZZLES[0]!.position[2] - 0.05],
    trims: THRUST,
    what: 'Four cold-gas nozzles in the rear diffuser. Air accelerates past the speed of sound in each bell and pushes the car forward directly, without going through the tires.',
    specs: [
      'rearNozzleCount',
      'rearThrustTotal',
      'nozzleCount',
      'cellcogFullThrust',
      'thrustVsTiresMin',
      'thrustVsTiresMax',
    ],
    estimates: ['nozzleAreaRatio', 'nozzleDischarge', 'thrustTrimLaunchDuty'],
    demo: { action: 'rear-burst', label: 'Fire a 1 s burst (brakes on)' },
  },
  {
    id: 'lift-nozzles',
    label: 'Lift nozzles (×4)',
    group: 'thrust',
    position: DOWN_NOZZLES[0]!.position,
    trims: ROCKET,
    what: 'Four nozzles near the corners point at the ground. Fired together they lift the car; fired unevenly they pitch and roll it.',
    specs: ['downNozzleCount', 'landingG', 'landingGAltitude', 'kickflipHeight'],
    estimates: ['downNozzleThrust'],
    demo: { action: 'lift-burst', label: 'Hop' },
  },
  {
    id: 'yaw-nozzles',
    label: 'Yaw nozzles (×2)',
    group: 'thrust',
    position: [0.97, YAW_NOZZLES[0]!.position[1], YAW_NOZZLES[0]!.position[2]],
    trims: ROCKET,
    what: 'Two small nozzles at the nose point left and right. They swing the nose around in the air, where the steering wheel does nothing.',
    specs: ['yawNozzleCount'],
    estimates: ['yawNozzleThrust'],
    demo: { action: 'yaw-burst', label: 'Spin the nose' },
  },
  {
    id: 'valves',
    label: 'Valves (on/off, PWM)',
    group: 'flight',
    position: [0.42, -0.1, -1.8],
    trims: THRUST,
    what: 'Cold-gas valves are either fully open or shut. To get "40 % thrust" they open for 40 % of each short cycle. That is pulse-width modulation, and the duty bars in the HUD show it.',
    specs: ['flightActuators'],
    estimates: ['pwmPeriod'],
    demo: { action: 'pwm', label: 'Pulse at 30 % duty' },
  },
  {
    id: 'flight-computer',
    label: 'Flight computer',
    group: 'flight',
    position: [0, 0.18, 0.75],
    trims: ROCKET,
    what: 'It reads the car’s attitude and spin many times a second and mixes the lift and yaw nozzles to hold, roll or level it. With the assists on, it also plans the landing burn.',
    specs: ['flightActuators', 'demoTrick'],
    estimates: ['downNozzleThrust'],
    demo: { action: 'roll', label: 'Hop and roll 180°' },
  },
  {
    id: 'fans',
    label: 'Underbody fans',
    group: 'suction',
    position: [0, -0.4, 0.55],
    trims: ALL,
    what: 'Battery-powered fans pump air out from under the sealed floor. The atmosphere then presses the car down, even when it is standing still.',
    specs: ['fanPatent', 'invertedDownforce', 'fanEnergy', 'fanModes', 'fanCorneringG'],
    estimates: [
      'suctionTarget',
      'floorArea',
      'fanShutoffPressure',
      'fanEfficiency',
      'fanCount',
      'fanSpinUpTime',
    ],
    demo: { action: 'fans', label: 'Spin the fans down and up' },
  },
  {
    id: 'skirts',
    label: 'Deployable skirts',
    group: 'suction',
    position: [0.8, -0.42, -0.3],
    trims: ALL,
    what: 'Skirts drop down to close the gap between floor and road. Every millimetre of gap leaks air back in, so the seal decides how much suction the fans can hold.',
    specs: ['fanPatent'],
    estimates: [
      'skirtReach',
      'sealGapNominal',
      'floorPerimeter',
      'leakDischarge',
      'suctionCollapseTime',
      'suctionBuildTime',
    ],
    demo: { action: 'skirts', label: 'Break the seal' },
  },
  {
    id: 'tires',
    label: 'Tires',
    group: 'tire',
    position: [WHEELS[0]!.anchor[0] + 0.15, -0.05, WHEELS[0]!.anchor[2]],
    trims: ALL,
    what: 'A tire can only push along the road as hard as it is pressed onto it, times a friction coefficient μ. Suction raises the pressing force, and thrust skips the tires entirely.',
    specs: ['tireOnlyGrip', 'fanCorneringG', 'perfAccelG'],
    estimates: ['motorPeakForce', 'motorPeakPower', 'vehicleMass'],
    demo: { action: 'launch-tires', label: 'Launch on tires only' },
  },
];

export const componentsFor = (trim: TrimId): CarComponent[] =>
  COMPONENTS.filter((c) => c.trims.includes(trim));
