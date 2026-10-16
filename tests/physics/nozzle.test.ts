import { describe, expect, it } from 'vitest';
import {
  REFERENCE,
  areaRatio,
  buildVehicleParams,
  chokedMassFlow,
  gasFor,
  machFromAreaRatio,
  nozzleGeometries,
  nozzlePerformance,
  nozzleProfile,
  pwmIsOpen,
  pwmOpenFraction,
} from '../../src/physics';
import { SPECS } from '../../src/data/specs';

const air = gasFor('air');
const { pressure: P0, temperature: T0, ambientPressure: PA } = REFERENCE;

describe('isentropic relations', () => {
  it('solves the area–Mach relation on both branches', () => {
    for (const M of [0.3, 0.7, 1.5, 3.7]) {
      const r = areaRatio(1.4, M);
      expect(machFromAreaRatio(1.4, r, M > 1)).toBeCloseTo(M, 4);
    }
  });
});

describe('rear thrusters', () => {
  const rear = nozzleGeometries().rear;
  const n = nozzlePerformance(rear, air, P0, T0, PA);

  it('4 rear nozzles give 80 kN ± 2 % at full default pressure', () => {
    const total = 4 * n.thrust;
    expect(total).toBeGreaterThan(80_000 * 0.98);
    expect(total).toBeLessThan(80_000 * 1.02);
  });

  it('uses ~114 kg/s at ~700 m/s effective exhaust velocity', () => {
    expect(4 * n.massFlow).toBeGreaterThan(105);
    expect(4 * n.massFlow).toBeLessThan(125);
    expect(n.effectiveVelocity).toBeGreaterThan(660);
    expect(n.effectiveVelocity).toBeLessThan(720);
  });

  it('matches the choked-flow formula', () => {
    const g = 1.4;
    const expected =
      rear.dischargeCoefficient *
      rear.throatArea *
      P0 *
      Math.sqrt(g / (air.R * T0)) *
      Math.pow(2 / (g + 1), (g + 1) / (2 * (g - 1)));
    expect(chokedMassFlow(rear, air, P0, T0)).toBeCloseTo(expected, 8);
    expect(n.choked).toBe(true);
  });

  it('is under-expanded at full pressure (shock diamonds)', () => {
    expect(n.regime).toBe('underexpanded');
    expect(n.exitPressure).toBeGreaterThan(PA);
  });

  it('a full fill lasts about two seconds of full rear thrust (CellCog)', () => {
    const seconds = SPECS.airMass.value / (4 * n.massFlow);
    expect(seconds).toBeGreaterThan(1.7);
    expect(seconds).toBeLessThan(2.5);
  });

  it('makes more thrust in a vacuum (Moon mode)', () => {
    const vacuum = nozzlePerformance(rear, air, P0, T0, 0);
    expect(vacuum.thrust).toBeGreaterThan(n.thrust);
    // Gain is exactly p_a·A_e per nozzle.
    expect(vacuum.thrust - n.thrust).toBeCloseTo(PA * rear.throatArea * rear.areaRatio, 3);
  });

  it('thrust falls roughly in proportion to tank pressure', () => {
    const half = nozzlePerformance(rear, air, P0 / 2, T0, PA);
    expect(half.thrust / n.thrust).toBeGreaterThan(0.45);
    expect(half.thrust / n.thrust).toBeLessThan(0.52);
  });

  it('handles low pressures: separated, then subsonic, then off', () => {
    expect(nozzlePerformance(rear, air, 4e5, T0, PA).regime).toBe('separated');
    expect(nozzlePerformance(rear, air, 1.5e5, T0, PA).regime).toBe('subsonic');
    expect(nozzlePerformance(rear, air, PA, T0, PA).regime).toBe('off');
    expect(nozzlePerformance(rear, air, 1.5e5, T0, PA).thrust).toBeGreaterThan(0);
  });

  it('the profile goes subsonic → Mach 1 at the throat → supersonic', () => {
    const prof = nozzleProfile(rear, air, P0, T0, PA, 40);
    const throat = prof[20]!;
    expect(throat.mach).toBeCloseTo(1, 2);
    expect(prof[0]!.mach).toBeLessThan(0.5);
    expect(prof[40]!.mach).toBeCloseTo(n.exitMach, 3);
  });
});

describe('lift nozzles', () => {
  it('hovering a 2,350 kg car takes ≈ 23 kN and 30–35 kg/s of air', () => {
    const vp = buildVehicleParams('rocket');
    const weight = 2350 * vp.env.gravity;
    expect(weight).toBeGreaterThan(23_000 * 0.99);
    expect(weight).toBeLessThan(23_100);
    const down = nozzlePerformance(nozzleGeometries().down, air, P0, T0, PA);
    const consumption = (weight / down.thrust) * down.massFlow;
    expect(consumption).toBeGreaterThan(30);
    expect(consumption).toBeLessThan(35);
  });
});

describe('PWM valves', () => {
  it('average open fraction equals duty over whole periods', () => {
    const period = 0.04;
    let open = 0;
    const dt = 1 / 120;
    for (let i = 0; i < 1200; i++) open += pwmOpenFraction(i * dt, dt, period, 0.3) * dt;
    expect(open / (1200 * dt)).toBeCloseTo(0.3, 3);
  });

  it('is on/off at any instant', () => {
    expect(pwmIsOpen(0.001, 0.04, 0.25)).toBe(true);
    expect(pwmIsOpen(0.02, 0.04, 0.25)).toBe(false);
  });
});
