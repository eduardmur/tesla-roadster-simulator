/**
 * Gas properties, equation of state and isentropic flow relations.
 * Pure functions, SI units throughout (Pa, K, kg, m³, m/s).
 */

export interface Gas {
  name: 'air' | 'nitrogen';
  /** Heat capacity ratio γ = cp/cv. */
  gamma: number;
  /** Specific gas constant R in J/(kg·K). */
  R: number;
}

export const AIR: Gas = { name: 'air', gamma: 1.4, R: 287 };
export const NITROGEN: Gas = { name: 'nitrogen', gamma: 1.4, R: 296.8 };

export function makeGas(name: Gas['name'], gamma: number, R: number): Gas {
  return { name, gamma, R };
}

/** Specific heat at constant volume, J/(kg·K). */
export const cv = (gas: Gas): number => gas.R / (gas.gamma - 1);
/** Specific heat at constant pressure, J/(kg·K). */
export const cp = (gas: Gas): number => (gas.gamma * gas.R) / (gas.gamma - 1);

/**
 * Real-gas correction: we use a linear compressibility factor Z(p) = 1 + b·p,
 * so p·V = Z·m·R·T. b = 0 gives the ideal gas.
 */
export interface Eos {
  gas: Gas;
  /** Compressibility slope b in 1/Pa. */
  b: number;
}

/** Compressibility slope that makes Z(p) = z at pressure p. */
export function compressibilitySlope(z: number, p: number): number {
  return (z - 1) / p;
}

export function compressibilityAt(eos: Eos, p: number): number {
  return 1 + eos.b * p;
}

/** Pressure from density and temperature: p = ρRT / (1 − b·ρRT). */
export function pressureFromDensity(eos: Eos, rho: number, T: number): number {
  const ideal = rho * eos.gas.R * T;
  const denom = 1 - eos.b * ideal;
  if (denom <= 0.05) return ideal / 0.05; // outside the model's range; keep finite
  return ideal / denom;
}

/** Density from pressure and temperature: ρ = p / (Z(p)·R·T). */
export function densityFromPressure(eos: Eos, p: number, T: number): number {
  return p / (compressibilityAt(eos, p) * eos.gas.R * T);
}

/** Speed of sound a = √(γRT). */
export function speedOfSound(gas: Gas, T: number): number {
  return Math.sqrt(gas.gamma * gas.R * Math.max(T, 1));
}

// --- Isentropic relations (stagnation → static) ----------------------------------------------

/** T/T₀ for Mach M. */
export function temperatureRatio(gamma: number, M: number): number {
  return 1 / (1 + 0.5 * (gamma - 1) * M * M);
}

/** p/p₀ for Mach M. */
export function pressureRatio(gamma: number, M: number): number {
  return Math.pow(temperatureRatio(gamma, M), gamma / (gamma - 1));
}

/** Mach number from static/stagnation pressure ratio p/p₀ (isentropic). */
export function machFromPressureRatio(gamma: number, pOverP0: number): number {
  const r = Math.min(Math.max(pOverP0, 1e-12), 1);
  return Math.sqrt((2 / (gamma - 1)) * (Math.pow(r, -(gamma - 1) / gamma) - 1));
}

/** Area ratio A/A* for Mach M. */
export function areaRatio(gamma: number, M: number): number {
  const m = Math.max(M, 1e-9);
  const k = (gamma + 1) / (2 * (gamma - 1));
  return (1 / m) * Math.pow((2 / (gamma + 1)) * (1 + 0.5 * (gamma - 1) * m * m), k);
}

/**
 * Solve A/A* = ratio for Mach. `supersonic` picks the branch.
 * Bisection in log space is robust and plenty fast for our sizes.
 */
export function machFromAreaRatio(gamma: number, ratio: number, supersonic: boolean): number {
  if (ratio <= 1) return 1;
  let lo = supersonic ? 1 : 1e-6;
  let hi = supersonic ? 50 : 1;
  for (let i = 0; i < 80; i++) {
    const mid = 0.5 * (lo + hi);
    const f = areaRatio(gamma, mid) - ratio;
    // Subsonic branch: A/A* decreases with M. Supersonic: increases.
    if (supersonic ? f > 0 : f < 0) hi = mid;
    else lo = mid;
  }
  return 0.5 * (lo + hi);
}

/** Critical (choking) pressure ratio p_crit/p₀ = (2/(γ+1))^(γ/(γ−1)) ≈ 0.528 for γ = 1.4. */
export function criticalPressureRatio(gamma: number): number {
  return Math.pow(2 / (gamma + 1), gamma / (gamma - 1));
}

/** Adiabatic (isentropic) temperature after expanding from (p₀,T₀) to p: T = T₀·(p/p₀)^((γ−1)/γ). */
export function isentropicTemperature(gamma: number, T0: number, p0: number, p: number): number {
  return T0 * Math.pow(p / p0, (gamma - 1) / gamma);
}
