import { describe, expect, it } from 'vitest';
import {
  REFERENCE,
  buildVehicleParams,
  compressibilityAt,
  fillTank,
  gasFor,
  isentropicTemperature,
  nozzleGeometries,
  nozzlePerformance,
  stepTank,
  type ThermalMode,
} from '../../src/physics';

const air = gasFor('air');

function blowdownToThird(mode: ThermalMode) {
  const vp = buildVehicleParams('rocket');
  const cfg = { ...vp.tank!, thermalMode: mode };
  const rear = nozzleGeometries().rear;
  let s = fillTank(cfg, REFERENCE.pressure, REFERENCE.temperature);
  const p0 = s.pressure;
  const dt = 1 / 120;
  let t = 0;
  while (s.pressure > p0 / 3 && t < 20) {
    const n = nozzlePerformance(rear, air, s.pressure, s.temperature, REFERENCE.ambientPressure);
    s = stepTank(s, cfg, 4 * n.massFlow, dt);
    t += dt;
  }
  return { t, s, p0 };
}

describe('tank', () => {
  it('600 L at 5,500 psi and 20 °C holds ≈ 250 kg (with Z)', () => {
    const vp = buildVehicleParams('rocket');
    expect(vp.tank!.volume).toBeCloseTo(0.6, 6);
    expect(vp.tankFull!.mass).toBeCloseTo(250, 1);
    const z = compressibilityAt(vp.eos, REFERENCE.pressure);
    expect(z).toBeGreaterThan(1.05);
    expect(z).toBeLessThan(1.12);
  });

  it('Thrust trim holds a third of that in its 200 L tank', () => {
    const vp = buildVehicleParams('thrust');
    expect(vp.tankFull!.mass).toBeCloseTo(250 / 3, 1);
  });

  it.each(['adiabatic', 'isothermal', 'blended'] as const)(
    'full rear thrust blows down to 1/3 pressure in 1.5–3 s (%s)',
    (mode) => {
      const { t } = blowdownToThird(mode);
      expect(t).toBeGreaterThan(1.5);
      expect(t).toBeLessThan(3);
    },
  );

  it('adiabatic blowdown cools the gas like T₀·(p/p₀)^((γ−1)/γ)', () => {
    const { s, p0 } = blowdownToThird('adiabatic');
    // Z ≠ 1 makes this approximate; within 3 %.
    const expected = isentropicTemperature(1.4, REFERENCE.temperature, p0, s.pressure);
    expect(Math.abs(s.temperature - expected) / expected).toBeLessThan(0.03);
    expect(s.temperature).toBeLessThan(230);
  });

  it('isothermal blowdown keeps the temperature', () => {
    const { s } = blowdownToThird('isothermal');
    expect(s.temperature).toBeCloseTo(REFERENCE.temperature, 6);
  });

  it('blended mode sits between the two and warms back up at rest', () => {
    const vp = buildVehicleParams('rocket');
    const cfg = { ...vp.tank!, thermalMode: 'blended' as const };
    const { s } = blowdownToThird('blended');
    const adi = blowdownToThird('adiabatic').s;
    expect(s.temperature).toBeGreaterThanOrEqual(adi.temperature - 1e-9);
    let rest = s;
    for (let i = 0; i < 120 * 600; i++) rest = stepTank(rest, cfg, 0, 1 / 120);
    expect(rest.temperature).toBeGreaterThan(s.temperature + 20);
    expect(rest.pressure).toBeGreaterThan(s.pressure);
  });

  it('never goes negative when drained hard', () => {
    const vp = buildVehicleParams('thrust');
    let s = vp.tankFull!;
    for (let i = 0; i < 100; i++) s = stepTank(s, vp.tank!, 1000, 0.01);
    expect(s.mass).toBeGreaterThan(0);
    expect(Number.isFinite(s.pressure)).toBe(true);
    expect(Number.isFinite(s.temperature)).toBe(true);
  });
});
