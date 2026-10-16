import { describe, expect, it } from 'vitest';
import {
  downforceToHold,
  frictionCircle,
  gripBudget,
  maxTractionAcceleration,
  normalLoad,
} from '../../src/physics';

const g = 9.80665;
const m = 2350;
const mu = 1.26;

describe('tires', () => {
  it('tires alone give ≈ 1.26 g', () => {
    expect(maxTractionAcceleration(mu, m, g, 0) / g).toBeCloseTo(1.26, 6);
  });

  it('more normal force means more grip', () => {
    const plain = maxTractionAcceleration(mu, m, g, 0);
    const sucked = maxTractionAcceleration(mu, m, g, 46_000);
    expect(sucked).toBeGreaterThan(2.9 * plain);
  });

  it('with ~46 kN of suction the car can hang from a ceiling', () => {
    expect(normalLoad(m, g, -1, 46_000)).toBeGreaterThan(20_000);
    expect(downforceToHold(m, g, mu, -1)).toBeCloseTo(m * g, 6);
    // On a vertical wall it only needs weight/μ.
    expect(downforceToHold(m, g, mu, 0)).toBeCloseTo((m * g) / mu, 6);
  });

  it('friction circle scales the request back onto μN', () => {
    const r = frictionCircle(30_000, 40_000, 25_000);
    expect(Math.hypot(r.fx, r.fy)).toBeCloseTo(25_000, 6);
    expect(r.sliding).toBe(true);
    expect(frictionCircle(1000, 0, 25_000).sliding).toBe(false);
  });

  it('thrust bypasses the friction limit entirely', () => {
    const b = gripBudget(mu, m, g, 0, 80_000);
    expect(b.thrust).toBeGreaterThan(2.5 * b.tireOnly);
  });
});
