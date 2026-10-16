/**
 * Converging–diverging cold-gas nozzle, quasi-1D isentropic flow.
 *
 *   choked mass flow   ṁ = C_d·A_t·p₀·√(γ/(R·T₀))·(2/(γ+1))^((γ+1)/(2(γ−1)))
 *   exit Mach          from A_e/A_t (supersonic branch, solved numerically)
 *   thrust             F = ṁ·v_e + (p_e − p_a)·A_e
 *
 * When the jet is strongly over-expanded we apply the Summerfield separation criterion
 * (flow leaves the wall where p ≈ 0.4·p_a), which avoids the unphysical thrust collapse
 * the pure formula predicts at low tank pressure.
 */
import {
  areaRatio,
  criticalPressureRatio,
  machFromAreaRatio,
  machFromPressureRatio,
  pressureRatio,
  temperatureRatio,
  type Gas,
} from './gas';

export interface NozzleGeometry {
  /** Throat area A_t, m². */
  throatArea: number;
  /** Exit-to-throat area ratio A_e/A_t. */
  areaRatio: number;
  /** Discharge coefficient C_d (0..1). */
  dischargeCoefficient: number;
}

export type FlowRegime =
  'off' | 'subsonic' | 'underexpanded' | 'ideal' | 'overexpanded' | 'separated';

export interface NozzleState {
  massFlow: number;
  thrust: number;
  exitMach: number;
  exitPressure: number;
  exitTemperature: number;
  exitVelocity: number;
  /** F/ṁ, m/s. */
  effectiveVelocity: number;
  choked: boolean;
  regime: FlowRegime;
}

const SUMMERFIELD = 0.4;

const OFF: NozzleState = {
  massFlow: 0,
  thrust: 0,
  exitMach: 0,
  exitPressure: 0,
  exitTemperature: 0,
  exitVelocity: 0,
  effectiveVelocity: 0,
  choked: false,
  regime: 'off',
};

/** Mass flux per unit area at Mach M: ṁ/A = p₀·√(γ/(R·T₀))·M·(1 + (γ−1)/2·M²)^(−(γ+1)/(2(γ−1))). */
function massFlux(gas: Gas, p0: number, T0: number, M: number): number {
  const g = gas.gamma;
  return (
    p0 *
    Math.sqrt(g / (gas.R * T0)) *
    M *
    Math.pow(1 + 0.5 * (g - 1) * M * M, -(g + 1) / (2 * (g - 1)))
  );
}

/** Choked mass flow through the throat. */
export function chokedMassFlow(geom: NozzleGeometry, gas: Gas, p0: number, T0: number): number {
  const g = gas.gamma;
  return (
    geom.dischargeCoefficient *
    geom.throatArea *
    p0 *
    Math.sqrt(g / (gas.R * T0)) *
    Math.pow(2 / (g + 1), (g + 1) / (2 * (g - 1)))
  );
}

export function nozzlePerformance(
  geom: NozzleGeometry,
  gas: Gas,
  p0: number,
  T0: number,
  pa: number,
): NozzleState {
  if (p0 <= pa * 1.0001 || p0 <= 0 || T0 <= 0) return OFF;
  const g = gas.gamma;
  const At = geom.throatArea;
  const Ae = At * geom.areaRatio;

  // Not choked: the whole nozzle is subsonic and the exit sits at ambient pressure.
  if (pa / p0 > criticalPressureRatio(g)) {
    const Mt = machFromPressureRatio(g, pa / p0);
    const massFlow = geom.dischargeCoefficient * At * massFlux(gas, p0, T0, Mt);
    const Te = T0 * temperatureRatio(g, Mt);
    const ve = Mt * Math.sqrt(g * gas.R * Te);
    const thrust = massFlow * ve;
    return {
      massFlow,
      thrust,
      exitMach: Mt,
      exitPressure: pa,
      exitTemperature: Te,
      exitVelocity: ve,
      effectiveVelocity: ve,
      choked: false,
      regime: 'subsonic',
    };
  }

  const massFlow = chokedMassFlow(geom, gas, p0, T0);
  let Me = machFromAreaRatio(g, geom.areaRatio, true);
  let pe = p0 * pressureRatio(g, Me);
  let exitArea = Ae;
  let regime: FlowRegime;

  if (pa > 0 && pe < SUMMERFIELD * pa) {
    // Flow separates inside the bell; the effective exit is where p = 0.4·p_a.
    const pSep = SUMMERFIELD * pa;
    Me = machFromPressureRatio(g, pSep / p0);
    pe = pSep;
    exitArea = At * areaRatio(g, Me);
    regime = 'separated';
  } else if (pa <= 0 || pe > pa * 1.02) {
    regime = 'underexpanded';
  } else if (pe < pa * 0.98) {
    regime = 'overexpanded';
  } else {
    regime = 'ideal';
  }

  const Te = T0 * temperatureRatio(g, Me);
  const ve = Me * Math.sqrt(g * gas.R * Te);
  const thrust = Math.max(0, massFlow * ve + (pe - pa) * exitArea);
  return {
    massFlow,
    thrust,
    exitMach: Me,
    exitPressure: pe,
    exitTemperature: Te,
    exitVelocity: ve,
    effectiveVelocity: massFlow > 0 ? thrust / massFlow : 0,
    choked: true,
    regime,
  };
}

/**
 * Throat area that makes `count` identical nozzles produce `totalThrust` at (p₀, T₀, p_a).
 * Every term of the thrust equation scales with A_t at a fixed area ratio, so this is exact.
 */
export function calibrateThroatArea(
  totalThrust: number,
  count: number,
  areaRatioValue: number,
  dischargeCoefficient: number,
  gas: Gas,
  p0: number,
  T0: number,
  pa: number,
): number {
  const unit = nozzlePerformance(
    { throatArea: 1, areaRatio: areaRatioValue, dischargeCoefficient },
    gas,
    p0,
    T0,
    pa,
  );
  return totalThrust / (count * unit.thrust);
}

export const throatDiameter = (area: number): number => 2 * Math.sqrt(area / Math.PI);

/**
 * Distance from the exit to the first shock diamond (Mach disk), rule of thumb
 * x ≈ 0.67·D·√(p_jet/p_a) (see Wikipedia, "Shock diamond"). We use exit diameter and
 * exit static pressure. Only meaningful when the jet is supersonic.
 */
export function firstShockDiamondDistance(
  state: NozzleState,
  exitDiameter: number,
  pa: number,
): number {
  if (!state.choked || pa <= 0) return 0;
  return 0.67 * exitDiameter * Math.sqrt(Math.max(1, state.exitPressure / pa));
}

export interface NozzleStation {
  /** Position along the axis normalised to [-1 (inlet), 0 (throat), 1 (exit)]. */
  x: number;
  areaRatio: number;
  mach: number;
  pressureRatio: number;
  temperatureRatio: number;
  /** True downstream of the separation point. */
  separated: boolean;
}

/**
 * Mach, p/p₀ and T/T₀ along the nozzle for the lab cross-section.
 * Inlet area ratio 3 (converging) → throat → exit (diverging, conical in area).
 */
export function nozzleProfile(
  geom: NozzleGeometry,
  gas: Gas,
  p0: number,
  T0: number,
  pa: number,
  samples = 48,
): NozzleStation[] {
  const g = gas.gamma;
  const state = nozzlePerformance(geom, gas, p0, T0, pa);
  const stations: NozzleStation[] = [];
  const inletRatio = 3;
  const pSep = SUMMERFIELD * pa;
  for (let i = 0; i <= samples; i++) {
    const x = -1 + (2 * i) / samples;
    const ratio =
      x < 0
        ? 1 + (inletRatio - 1) * (0.5 - 0.5 * Math.cos(Math.PI * -x)) // smooth converging wall
        : 1 + (geom.areaRatio - 1) * x;
    let M: number;
    let separated = false;
    if (state.regime === 'off') {
      M = 0;
    } else if (!state.choked) {
      // Subsonic everywhere: scale from the throat Mach.
      const aStar = 1 / areaRatio(g, Math.max(state.exitMach, 1e-4));
      M = machFromAreaRatio(g, ratio / aStar, false);
    } else {
      M = machFromAreaRatio(g, ratio, x > 0);
      if (x > 0 && state.regime === 'separated' && p0 * pressureRatio(g, M) < pSep) {
        separated = true;
      }
    }
    stations.push({
      x,
      areaRatio: ratio,
      mach: M,
      pressureRatio: pressureRatio(g, M),
      temperatureRatio: temperatureRatio(g, M),
      separated,
    });
  }
  return stations;
}

/**
 * Fraction of [t, t+dt] during which a PWM valve is open. The valve opens at the start of
 * each period and stays open for duty·period. Integrating the on-time exactly keeps the
 * average force right even when the PWM period is close to the physics step.
 */
export function pwmOpenFraction(t: number, dt: number, period: number, duty: number): number {
  const d = Math.min(Math.max(duty, 0), 1);
  if (d <= 0) return 0;
  if (d >= 1) return 1;
  const on = d * period;
  const openTimeUntil = (time: number): number => {
    const k = Math.floor(time / period);
    return k * on + Math.min(time - k * period, on);
  };
  return (openTimeUntil(t + dt) - openTimeUntil(t)) / dt;
}

/** Is the valve open at instant t? (for visualising the pulse train) */
export function pwmIsOpen(t: number, period: number, duty: number): boolean {
  const d = Math.min(Math.max(duty, 0), 1);
  if (d <= 0) return false;
  if (d >= 1) return true;
  const phase = t / period - Math.floor(t / period);
  return phase < d;
}
