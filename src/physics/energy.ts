/**
 * Refill energy. The minimum work to compress gas from ambient pressure into a tank,
 * if the compressor dumps heat so the gas stays at ambient temperature, is
 *   W_iso = m·R·T·ln(p_tank / p_ambient)
 * Real compressors are multi-stage and lose a lot to heat, so we divide by an efficiency.
 */
import type { Gas } from './gas';

export const JOULES_PER_KWH = 3.6e6;

export function isothermalCompressionEnergy(
  mass: number,
  gas: Gas,
  temperature: number,
  tankPressure: number,
  ambientPressure: number,
): number {
  if (tankPressure <= ambientPressure || mass <= 0) return 0;
  return mass * gas.R * temperature * Math.log(tankPressure / ambientPressure);
}

export interface RefillEnergy {
  idealKWh: number;
  realisticKWh: number;
}

export function refillEnergy(
  mass: number,
  gas: Gas,
  temperature: number,
  tankPressure: number,
  ambientPressure: number,
  compressorEfficiency: number,
): RefillEnergy {
  const ideal = isothermalCompressionEnergy(mass, gas, temperature, tankPressure, ambientPressure);
  return {
    idealKWh: ideal / JOULES_PER_KWH,
    realisticKWh: ideal / Math.max(compressorEfficiency, 1e-3) / JOULES_PER_KWH,
  };
}

/** Average compressor power needed to refill in `hours`, kW. */
export function refillPower(energyKWh: number, hours: number): number {
  return hours > 0 ? energyKWh / hours : Infinity;
}
