/**
 * Lumped-parameter pressure vessel (one or more COPVs plumbed together).
 *
 * Mass balance:    dm/dt = −ṁ
 * Energy balance:  m·cv·dT/dt = −ṁ·R·T + Q̇        (ideal-gas energy, real-gas pressure via Z)
 * Heat transfer:   Q̇ = hA·(T_wall − T)              (blended mode only)
 */
import { cv, densityFromPressure, pressureFromDensity, type Eos } from './gas';

export type ThermalMode = 'adiabatic' | 'isothermal' | 'blended';

export interface TankConfig {
  /** Internal volume, m³. */
  volume: number;
  eos: Eos;
  thermalMode: ThermalMode;
  /** Wall (and ambient) temperature, K. */
  wallTemperature: number;
  /** Wall heat-transfer conductance hA, W/K (blended mode). */
  heatTransfer: number;
}

export interface TankState {
  /** Gas mass, kg. */
  mass: number;
  /** Gas temperature, K. */
  temperature: number;
  /** Absolute pressure, Pa. */
  pressure: number;
}

/** A tank filled to pressure p at temperature T. */
export function fillTank(config: TankConfig, pressure: number, temperature: number): TankState {
  const rho = densityFromPressure(config.eos, pressure, temperature);
  return { mass: rho * config.volume, temperature, pressure };
}

export function tankPressure(config: TankConfig, mass: number, temperature: number): number {
  return pressureFromDensity(config.eos, mass / config.volume, temperature);
}

/**
 * Advance the tank by dt with outflow ṁ (kg/s). Returns a new state.
 * The adiabatic part uses the exact isentropic update T₂ = T₁·(m₂/m₁)^(γ−1),
 * which is unconditionally stable for any step size.
 */
export function stepTank(
  state: TankState,
  config: TankConfig,
  massFlowOut: number,
  dt: number,
): TankState {
  const { eos } = config;
  const minMass = 1e-6;
  const m1 = Math.max(state.mass, minMass);
  const m2 = Math.max(m1 - Math.max(massFlowOut, 0) * dt, minMass);
  let T = state.temperature;

  if (config.thermalMode === 'isothermal') {
    T = config.wallTemperature;
  } else {
    T = T * Math.pow(m2 / m1, eos.gas.gamma - 1);
    if (config.thermalMode === 'blended') {
      // Implicit (backward-Euler) wall heat transfer: stable even for tiny gas masses.
      const c = m2 * cv(eos.gas);
      const k = (config.heatTransfer * dt) / c;
      T = (T + k * config.wallTemperature) / (1 + k);
    }
  }

  return { mass: m2, temperature: T, pressure: tankPressure(config, m2, T) };
}

/** Fraction of usable gas left (above ambient). */
export function tankFraction(state: TankState, full: TankState): number {
  return full.mass > 0 ? Math.max(0, Math.min(1, state.mass / full.mass)) : 0;
}
