import { describe, expect, it } from 'vitest';
import {
  OPEN_GAP,
  buildVehicleParams,
  effectiveGap,
  equilibriumSuction,
  stepSuction,
  suctionDownforce,
  type SuctionState,
} from '../../src/physics';
import { SPECS } from '../../src/data/specs';

const vp = buildVehicleParams('performance');
const cfg = vp.suction;
const rho = vp.env.airDensity;
const pa = vp.env.ambientPressure;

describe('suction', () => {
  it('Δp = 11.5 kPa over 4 m² gives ≈ 46 kN', () => {
    expect(suctionDownforce(11_500, 4)).toBeCloseTo(46_000, 6);
  });

  it('a sealed floor at full fan speed reproduces the 4,700 kg readout', () => {
    const dp = equilibriumSuction(cfg, cfg.residualGap, 1, rho, pa);
    const kgf = (dp * cfg.floorArea) / SPECS.gravityEarth.value;
    expect(kgf).toBeGreaterThan(4700 * 0.97);
    expect(kgf).toBeLessThan(4700 * 1.03);
    // The "aha": only ~11 % below ambient pressure.
    expect(dp / pa).toBeGreaterThan(0.1);
    expect(dp / pa).toBeLessThan(0.13);
  });

  it('downforce is about twice the weight (Musk: "up to 2 Gs")', () => {
    const dp = equilibriumSuction(cfg, cfg.residualGap, 1, rho, pa);
    const ratio = (dp * cfg.floorArea) / (vp.mass * vp.env.gravity);
    expect(ratio).toBeGreaterThan(1.8);
    expect(ratio).toBeLessThan(2.2);
  });

  it('leakage grows quickly with gap', () => {
    const at = (gap: number) => equilibriumSuction(cfg, gap, 1, rho, pa);
    expect(at(0.006)).toBeLessThan(at(0.004));
    expect(at(0.02)).toBeLessThan(0.25 * at(0.004));
    expect(at(OPEN_GAP)).toBeLessThan(0.01 * at(0.004));
  });

  it('skirts follow the surface up to their reach', () => {
    expect(effectiveGap(cfg, [0.1, 0.1, 0.15])).toBeCloseTo(cfg.residualGap, 9);
    expect(effectiveGap(cfg, [Infinity, Infinity])).toBeGreaterThan(0.4);
  });

  it('suction collapses within a fraction of a second when the seal breaks', () => {
    let s: SuctionState = {
      fanSpeed: 1,
      deltaP: equilibriumSuction(cfg, cfg.residualGap, 1, rho, pa),
    };
    const start = s.deltaP;
    const dt = 1 / 120;
    let t = 0;
    while (s.deltaP > 0.1 * start && t < 2) {
      s = stepSuction(cfg, s, 1, OPEN_GAP + cfg.residualGap, pa, 293, dt);
      t += dt;
    }
    expect(t).toBeLessThan(0.3);
  });

  it('fans draw tens of kW when sealed, by P = Q·Δp/η', () => {
    let s: SuctionState = { fanSpeed: 0, deltaP: 0 };
    for (let i = 0; i < 600; i++) s = stepSuction(cfg, s, 1, cfg.residualGap, pa, 293, 1 / 120);
    const out = stepSuction(cfg, s, 1, cfg.residualGap, pa, 293, 1 / 120);
    expect(out.power).toBeGreaterThan(20_000);
    expect(out.power).toBeLessThan(150_000);
    expect(out.power).toBeCloseTo((out.flow * out.deltaP) / cfg.fanEfficiency, 0);
    expect(out.sealEfficiency).toBeGreaterThan(0.98);
  });

  it('there is nothing to suck on the Moon', () => {
    expect(equilibriumSuction(cfg, cfg.residualGap, 1, 0, 0)).toBe(0);
  });
});
