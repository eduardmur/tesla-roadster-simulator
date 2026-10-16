/**
 * Numbers our model derives from the specs (shown with a "sim" tag). Computed once from the
 * pure physics module at the reported conditions.
 */
import { SPECS } from './specs';
import {
  REFERENCE,
  buildVehicleParams,
  gasFor,
  nozzleGeometries,
  nozzlePerformance,
  simulateLaunch,
} from '../physics';

export interface Derived {
  value: number;
  unit: string;
  digits: number;
  note: string;
}

let cache: Record<string, Derived> | null = null;

/** Altitude (m) at pressure p in the International Standard Atmosphere troposphere. */
function standardAtmosphereAltitude(p: number): number {
  const p0 = SPECS.ambientPressure.value;
  // ISA: p = p0 · (1 − L·h/T0)^(g·M/(R*·L)), L = 0.0065 K/m, T0 = 288.15 K, exponent 5.25588.
  return (288.15 / 0.0065) * (1 - Math.pow(p / p0, 1 / 5.25588));
}

export function derived(): Record<string, Derived> {
  if (cache) return cache;
  const air = gasFor('air');
  const rear = nozzlePerformance(
    nozzleGeometries().rear,
    air,
    REFERENCE.pressure,
    REFERENCE.temperature,
    REFERENCE.ambientPressure,
  );
  const down = nozzlePerformance(
    nozzleGeometries().down,
    air,
    REFERENCE.pressure,
    REFERENCE.temperature,
    REFERENCE.ambientPressure,
  );
  const g = SPECS.gravityEarth.value;
  const weight = SPECS.vehicleMass.value * g;
  const downforceN = SPECS.invertedDownforce.value * g;
  const rocket = buildVehicleParams('rocket');
  const tires = simulateLaunch(buildVehicleParams('performance'), { fans: false, thrust: false });
  cache = {
    suctionPercent: {
      value: (downforceN / SPECS.floorArea.value / SPECS.ambientPressure.value) * 100,
      unit: '%',
      digits: 0,
      note: '4,700 kgf ÷ 4 m² floor, as a share of sea-level pressure',
    },
    exitMach: {
      value: rear.exitMach,
      unit: '',
      digits: 1,
      note: 'Exit Mach number of the rear nozzle at full pressure',
    },
    exhaustVelocity: {
      value: rear.effectiveVelocity,
      unit: 'm/s',
      digits: 0,
      note: 'Effective exhaust velocity F/ṁ at full pressure',
    },
    hoverThrust: {
      value: weight / 1000,
      unit: 'kN',
      digits: 0,
      note: 'Weight of the default 2,350 kg car',
    },
    hoverFlow: {
      value: (weight / down.thrust) * down.massFlow,
      unit: 'kg/s',
      digits: 0,
      note: 'Air the lift nozzles use to hover at full tank pressure',
    },
    fullThrustSeconds: {
      value: (rocket.tankFull?.mass ?? 0) / (rear.massFlow * SPECS.rearNozzleCount.value),
      unit: 's',
      digits: 1,
      note: '250 kg ÷ rear mass flow at full pressure',
    },
    tiresOnly060: {
      value: tires.time,
      unit: 's',
      digits: 1,
      note: '0–60 mph on tires alone in our launch model',
    },
    downforceKN: {
      value: downforceN / 1000,
      unit: 'kN',
      digits: 0,
      note: '4,700 kgf × standard gravity',
    },
    ceilingLoadKN: {
      value: (downforceN - weight) / 1000,
      unit: 'kN',
      digits: 0,
      note: 'Suction minus the weight of a 2,350 kg car',
    },
    idealGasMass: {
      value:
        (REFERENCE.pressure * (SPECS.airVolumeTotal.value / 1000)) /
        (air.R * REFERENCE.temperature),
      unit: 'kg',
      digits: 0,
      note: 'p·V/(R·T) for 600 L at 5,500 psi and 20 °C, ignoring compressibility',
    },
    hillAltitude: {
      value: standardAtmosphereAltitude(
        SPECS.ambientPressure.value - downforceN / SPECS.floorArea.value,
      ),
      unit: 'm',
      digits: 0,
      note: 'Altitude in the standard atmosphere where pressure is 11.5 kPa below sea level',
    },
  };
  return cache;
}
