/**
 * Turns the reported specs and our estimates (src/data/specs.ts) into SI simulation
 * parameters for one trim, optionally modified by "what if" sliders.
 *
 * Calibration happens at the *reported* reference conditions (5,500 psi, 20 °C, sea level,
 * air). What-if changes are then applied on top, so e.g. raising tank pressure raises thrust.
 */
import { SPECS } from '../data/specs';
import { AIR, NITROGEN, compressibilitySlope, type Eos, type Gas } from './gas';
import {
  DOWN_NOZZLES,
  INERTIA_PER_2350,
  REAR_NOZZLES,
  YAW_NOZZLES,
  type NozzleLayout,
} from './layout';
import type { V3 } from './math';
import { calibrateThroatArea, type NozzleGeometry } from './nozzle';
import { airDensity, calibrateFanMaxFlow, type SuctionConfig } from './suction';
import { fillTank, type TankConfig, type TankState, type ThermalMode } from './tank';

export const PSI = 6894.757293168;
export const MPH = 0.44704;
export const KMH = 1 / 3.6;
export const SIXTY_MPH = 60 * MPH;

export type TrimId = 'performance' | 'thrust' | 'rocket';
export const TRIMS: TrimId[] = ['performance', 'thrust', 'rocket'];

export const TRIM_LABELS: Record<TrimId, string> = {
  performance: 'Performance',
  thrust: 'Thrust',
  rocket: 'Rocket',
};

export type GasChoice = 'air' | 'nitrogen';

export interface WhatIf {
  /** Full tank pressure, psi. */
  tankPressurePsi: number;
  /** Multiplier on the trim's reported tank volume. */
  tankVolumeScale: number;
  /** Vehicle mass with full tanks, kg. */
  massKg: number;
  /** Multiplier on fan shaft power. */
  fanPowerScale: number;
  /** Gravity, m/s². */
  gravity: number;
  /** Ambient pressure, Pa. */
  ambientPressure: number;
  gas: GasChoice;
  thermalMode: ThermalMode;
}

export function reportedWhatIf(): WhatIf {
  return {
    tankPressurePsi: SPECS.thrusterPressure.value,
    tankVolumeScale: 1,
    massKg: SPECS.vehicleMass.value,
    fanPowerScale: 1,
    gravity: SPECS.gravityEarth.value,
    ambientPressure: SPECS.ambientPressure.value,
    gas: 'air',
    thermalMode: 'blended',
  };
}

/** True when every slider is at its "as reported" value. */
export function isReported(w: WhatIf): boolean {
  const r = reportedWhatIf();
  return (
    w.tankPressurePsi === r.tankPressurePsi &&
    w.tankVolumeScale === r.tankVolumeScale &&
    w.massKg === r.massKg &&
    w.fanPowerScale === r.fanPowerScale &&
    w.gravity === r.gravity &&
    w.ambientPressure === r.ambientPressure &&
    w.gas === r.gas
  );
}

export type ThrusterKind = 'rear' | 'down' | 'yaw';

export interface ThrusterGroup {
  kind: ThrusterKind;
  nozzles: NozzleLayout[];
  geometry: NozzleGeometry;
  /** Highest average valve duty the trim allows (Thrust trim is capped, see specs). */
  maxDuty: number;
}

export interface TankPart {
  id: 'main' | 'passenger';
  label: string;
  volume: number;
}

export interface Environment {
  gravity: number;
  ambientPressure: number;
  ambientTemperature: number;
  airDensity: number;
}

export interface VehicleParams {
  trim: TrimId;
  whatIf: WhatIf;
  /** Mass with full tanks, kg. */
  mass: number;
  /** Mass with empty tanks, kg. */
  dryMass: number;
  inertia: V3;
  gas: Gas;
  eos: Eos;
  tank: TankConfig | null;
  tankFull: TankState | null;
  tankParts: TankPart[];
  thrusters: ThrusterGroup[];
  pwmPeriod: number;
  hasFans: boolean;
  suction: SuctionConfig;
  /** Design suction Δp at full fan speed, Pa (≈ 11.5 kPa). */
  suctionTarget: number;
  mu: number;
  motorPeakForce: number;
  motorPeakPower: number;
  /** Electronic limiter: the motors fade out at this speed, m/s. */
  topSpeed: number;
  dragArea: number;
  rollingResistance: number;
  env: Environment;
  compressorEfficiency: number;
}

/** Reference conditions every calibration is done at. */
export const REFERENCE = {
  pressure: SPECS.thrusterPressure.value * PSI,
  temperature: SPECS.ambientTemperature.value,
  ambientPressure: SPECS.ambientPressure.value,
};

export function gasFor(choice: GasChoice): Gas {
  return choice === 'nitrogen'
    ? { ...NITROGEN, R: SPECS.rNitrogen.value, gamma: SPECS.gammaAir.value }
    : { ...AIR, R: SPECS.rAir.value, gamma: SPECS.gammaAir.value };
}

/** Compressibility slope so the reported 600 L hold the reported 250 kg at 5,500 psi. */
export function calibratedEos(gas: Gas): Eos {
  const p = REFERENCE.pressure;
  const V = SPECS.airVolumeTotal.value / 1000;
  const ideal = (p * V) / (gas.R * REFERENCE.temperature);
  const z = ideal / SPECS.airMass.value;
  return { gas, b: compressibilitySlope(z, p) };
}

function nozzleGeometry(totalThrust: number, count: number): NozzleGeometry {
  const areaRatio = SPECS.nozzleAreaRatio.value;
  const cd = SPECS.nozzleDischarge.value;
  const throatArea = calibrateThroatArea(
    totalThrust,
    count,
    areaRatio,
    cd,
    gasFor('air'),
    REFERENCE.pressure,
    REFERENCE.temperature,
    REFERENCE.ambientPressure,
  );
  return { throatArea, areaRatio, dischargeCoefficient: cd };
}

let cachedGeometry: Record<ThrusterKind, NozzleGeometry> | null = null;

/** Throat areas calibrated to the reported/estimated thrust at reference conditions. */
export function nozzleGeometries(): Record<ThrusterKind, NozzleGeometry> {
  if (!cachedGeometry) {
    cachedGeometry = {
      rear: nozzleGeometry(SPECS.rearThrustTotal.value * 1000, SPECS.rearNozzleCount.value),
      down: nozzleGeometry(SPECS.downNozzleThrust.value * 1000, 1),
      yaw: nozzleGeometry(SPECS.yawNozzleThrust.value * 1000, 1),
    };
  }
  return cachedGeometry;
}

export function tankPartsFor(trim: TrimId): TankPart[] {
  if (trim === 'performance') return [];
  const main: TankPart = {
    id: 'main',
    label: 'Main COPV (behind the seats)',
    volume: SPECS.thrustTankVolume.value / 1000,
  };
  if (trim === 'thrust') return [main];
  return [
    main,
    {
      id: 'passenger',
      label: 'Second COPV (passenger seat)',
      volume: SPECS.rocketSecondTank.value / 1000,
    },
  ];
}

export function suctionConfig(fanPowerScale: number): { config: SuctionConfig; target: number } {
  const rhoRef = airDensity(REFERENCE.ambientPressure, REFERENCE.temperature, SPECS.rAir.value);
  const target = SPECS.suctionTarget.value * 1000;
  const base: Omit<SuctionConfig, 'fanMaxFlow'> = {
    floorArea: SPECS.floorArea.value,
    perimeter: SPECS.floorPerimeter.value,
    skirtReach: SPECS.skirtReach.value,
    residualGap: SPECS.sealGapNominal.value / 1000,
    fanShutoffPressure: SPECS.fanShutoffPressure.value * 1000,
    fanEfficiency: SPECS.fanEfficiency.value,
    leakDischarge: SPECS.leakDischarge.value,
    referenceDensity: rhoRef,
    collapseTime: SPECS.suctionCollapseTime.value,
    buildTime: SPECS.suctionBuildTime.value,
    fanSpinUpTime: SPECS.fanSpinUpTime.value,
  };
  const fanMaxFlow = calibrateFanMaxFlow(base, target, rhoRef);
  // Fan affinity laws: power ∝ n³, so a power multiplier k scales pressure by k^(2/3), flow by k^(1/3).
  const k = Math.max(fanPowerScale, 0);
  return {
    config: {
      ...base,
      fanShutoffPressure: base.fanShutoffPressure * Math.pow(k, 2 / 3),
      fanMaxFlow: fanMaxFlow * Math.pow(k, 1 / 3),
    },
    target,
  };
}

export function buildVehicleParams(trim: TrimId, whatIf: WhatIf = reportedWhatIf()): VehicleParams {
  const gas = gasFor(whatIf.gas);
  const eos = calibratedEos(gas);
  const env: Environment = {
    gravity: whatIf.gravity,
    ambientPressure: whatIf.ambientPressure,
    ambientTemperature: SPECS.ambientTemperature.value,
    airDensity: airDensity(
      whatIf.ambientPressure,
      SPECS.ambientTemperature.value,
      SPECS.rAir.value,
    ),
  };

  const parts = tankPartsFor(trim).map((p) => ({
    ...p,
    volume: p.volume * whatIf.tankVolumeScale,
  }));
  const volume = parts.reduce((s, p) => s + p.volume, 0);
  const tank: TankConfig | null =
    volume > 0
      ? {
          volume,
          eos,
          thermalMode: whatIf.thermalMode,
          wallTemperature: env.ambientTemperature,
          heatTransfer: SPECS.tankHeatTransfer.value * 1000,
        }
      : null;
  const tankFull = tank
    ? fillTank(tank, whatIf.tankPressurePsi * PSI, env.ambientTemperature)
    : null;

  const geo = nozzleGeometries();
  const thrusters: ThrusterGroup[] = [];
  if (trim !== 'performance') {
    thrusters.push({
      kind: 'rear',
      nozzles: REAR_NOZZLES,
      geometry: geo.rear,
      maxDuty: trim === 'thrust' ? SPECS.thrustTrimLaunchDuty.value : 1,
    });
  }
  if (trim === 'rocket') {
    thrusters.push({ kind: 'down', nozzles: DOWN_NOZZLES, geometry: geo.down, maxDuty: 1 });
    thrusters.push({ kind: 'yaw', nozzles: YAW_NOZZLES, geometry: geo.yaw, maxDuty: 1 });
  }

  const mass = whatIf.massKg;
  const airMass = tankFull?.mass ?? 0;
  const dryMass = Math.max(mass - airMass, 100);
  const inertiaScale = mass / 2350;
  const { config: suction, target } = suctionConfig(whatIf.fanPowerScale);

  return {
    trim,
    whatIf,
    mass: dryMass + airMass,
    dryMass,
    inertia: [
      INERTIA_PER_2350[0] * inertiaScale,
      INERTIA_PER_2350[1] * inertiaScale,
      INERTIA_PER_2350[2] * inertiaScale,
    ],
    gas,
    eos,
    tank,
    tankFull,
    tankParts: parts,
    thrusters,
    pwmPeriod: SPECS.pwmPeriod.value / 1000,
    hasFans: true,
    suction,
    suctionTarget: target,
    mu: SPECS.tireOnlyGrip.value,
    motorPeakForce: SPECS.motorPeakForce.value * 1000,
    motorPeakPower: SPECS.motorPeakPower.value * 1000,
    topSpeed: SPECS.topSpeed.value * MPH,
    dragArea: SPECS.dragArea.value,
    rollingResistance: SPECS.rollingResistance.value,
    env,
    compressorEfficiency: SPECS.compressorEfficiency.value,
  };
}

/** Tractive force the motors can deliver at speed v (before the tire limit). */
export function motorForce(params: VehicleParams, speed: number, throttle = 1): number {
  const v = Math.max(Math.abs(speed), 0.1);
  // Limiter at the top-speed target: the motors fade out over the last 2 m/s.
  const limiter = Math.min(1, Math.max(0, (params.topSpeed - v) / 2));
  return throttle * limiter * Math.min(params.motorPeakForce, params.motorPeakPower / v);
}

export function thrusterGroup(
  params: VehicleParams,
  kind: ThrusterKind,
): ThrusterGroup | undefined {
  return params.thrusters.find((g) => g.kind === kind);
}
