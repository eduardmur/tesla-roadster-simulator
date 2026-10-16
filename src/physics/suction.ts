/**
 * Fan-car suction: underbody fans pump air out of a skirted plenum; air leaks back in
 * under the skirts. The equilibrium suction Δp is where fan flow equals leak flow.
 *
 *   fan curve      Q_fan = Q_max·n·√(1 − Δp/(Δp_max·n²·ρ/ρ_ref))   (n = fan speed 0..1)
 *   leakage        Q_leak = C_d·P·g·√(2Δp/ρ)                         (P = skirt perimeter, g = gap)
 *   downforce      D = Δp_design·A·η_seal = Δp·A
 *   fan power      P_fan = Q·Δp/η
 *
 * Downforce acts along the car's local −Y, toward whatever surface the skirts are sealed
 * against — floor, wall or ceiling.
 */

export interface SuctionConfig {
  /** Sealed floor area A, m². */
  floorArea: number;
  /** Skirt perimeter P, m. */
  perimeter: number;
  /** How far the skirts can extend to follow the surface, m. */
  skirtReach: number;
  /** Equivalent leak gap when the skirts are touching, m. */
  residualGap: number;
  /** Fan shut-off suction at full speed in sea-level air, Pa. */
  fanShutoffPressure: number;
  /** Fan free-delivery flow at full speed, m³/s. */
  fanMaxFlow: number;
  fanEfficiency: number;
  leakDischarge: number;
  /** Air density the fan curve was specified at, kg/m³. */
  referenceDensity: number;
  collapseTime: number;
  buildTime: number;
  fanSpinUpTime: number;
}

export interface SuctionState {
  /** Fan speed fraction 0..1. */
  fanSpeed: number;
  /** Underbody suction (gauge, positive = below ambient), Pa. */
  deltaP: number;
}

export interface SuctionOutput extends SuctionState {
  downforce: number;
  /** Suction the fans would hold with a perfect seal at the current speed, Pa. */
  sealedDeltaP: number;
  /** Δp / sealed Δp, 0..1. */
  sealEfficiency: number;
  /** Air pumped by the fans (= leak flow in steady state), m³/s. */
  flow: number;
  /** Electrical fan power, W. */
  power: number;
  /** Effective average skirt gap used for leakage, m. */
  gap: number;
}

/** Gap assigned to a skirt ray that finds no surface at all. */
export const OPEN_GAP = 0.5;

export function airDensity(pressure: number, temperature: number, R = 287): number {
  return pressure / (R * temperature);
}

function shutoff(cfg: SuctionConfig, n: number, rho: number, pa: number): number {
  // Fan pressure rise scales with n² and with air density; it can never exceed ambient.
  const dp = cfg.fanShutoffPressure * n * n * (rho / cfg.referenceDensity);
  return Math.min(dp, 0.95 * pa);
}

export function fanFlow(
  cfg: SuctionConfig,
  deltaP: number,
  n: number,
  rho: number,
  pa: number,
): number {
  const dpMax = shutoff(cfg, n, rho, pa);
  if (n <= 0 || dpMax <= 0) return 0;
  return cfg.fanMaxFlow * n * Math.sqrt(Math.max(0, 1 - deltaP / dpMax));
}

export function leakFlow(cfg: SuctionConfig, deltaP: number, gap: number, rho: number): number {
  if (deltaP <= 0 || rho <= 0) return 0;
  return cfg.leakDischarge * cfg.perimeter * gap * Math.sqrt((2 * deltaP) / rho);
}

/** Steady-state suction for a given gap and fan speed (bisection on fan − leak = 0). */
export function equilibriumSuction(
  cfg: SuctionConfig,
  gap: number,
  n: number,
  rho: number,
  pa: number,
): number {
  const dpMax = shutoff(cfg, n, rho, pa);
  if (dpMax <= 0) return 0;
  let lo = 0;
  let hi = dpMax;
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (lo + hi);
    if (fanFlow(cfg, mid, n, rho, pa) > leakFlow(cfg, mid, gap, rho)) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/** Free-delivery flow that makes the fans hold `targetDeltaP` at the residual (sealed) gap. */
export function calibrateFanMaxFlow(
  cfg: Omit<SuctionConfig, 'fanMaxFlow'>,
  targetDeltaP: number,
  rho: number,
): number {
  const leak = leakFlow({ ...cfg, fanMaxFlow: 0 }, targetDeltaP, cfg.residualGap, rho);
  return leak / Math.sqrt(1 - targetDeltaP / cfg.fanShutoffPressure);
}

/**
 * Effective leak gap from skirt raycasts. Each ray reports the distance from the floor
 * to the surface along local −Y (or Infinity on a miss). Skirts extend up to `skirtReach`;
 * whatever is left over is open gap. Leakage is perimeter-weighted, so we average.
 */
export function effectiveGap(cfg: SuctionConfig, rayDistances: readonly number[]): number {
  if (rayDistances.length === 0) return OPEN_GAP;
  let sum = 0;
  for (const d of rayDistances) {
    sum += Number.isFinite(d) ? Math.min(Math.max(d - cfg.skirtReach, 0), OPEN_GAP) : OPEN_GAP;
  }
  return cfg.residualGap + sum / rayDistances.length;
}

/** Steady downforce: Δp × A × seal efficiency. */
export function suctionDownforce(deltaPDesign: number, area: number, sealEfficiency = 1): number {
  return deltaPDesign * area * sealEfficiency;
}

/** Advance fan speed and plenum suction by dt. */
export function stepSuction(
  cfg: SuctionConfig,
  state: SuctionState,
  fanCommand: number,
  gap: number,
  ambientPressure: number,
  ambientTemperature: number,
  dt: number,
): SuctionOutput {
  const rho = airDensity(ambientPressure, ambientTemperature);
  const cmd = Math.min(Math.max(fanCommand, 0), 1);
  const fanSpeed =
    state.fanSpeed + (cmd - state.fanSpeed) * (1 - Math.exp(-dt / cfg.fanSpinUpTime));
  const target = equilibriumSuction(cfg, gap, fanSpeed, rho, ambientPressure);
  const tau = target < state.deltaP ? cfg.collapseTime : cfg.buildTime;
  const deltaP = state.deltaP + (target - state.deltaP) * (1 - Math.exp(-dt / tau));
  const sealedDeltaP = equilibriumSuction(cfg, cfg.residualGap, fanSpeed, rho, ambientPressure);
  const flow = leakFlow(cfg, deltaP, gap, rho);
  return {
    fanSpeed,
    deltaP,
    downforce: deltaP * cfg.floorArea,
    sealedDeltaP,
    sealEfficiency: sealedDeltaP > 1 ? Math.min(1, deltaP / sealedDeltaP) : 0,
    flow,
    power: (Math.min(flow, cfg.fanMaxFlow * fanSpeed) * deltaP) / cfg.fanEfficiency,
    gap,
  };
}
