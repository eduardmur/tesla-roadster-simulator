import { describe, expect, it } from 'vitest';
import { REFERENCE, gasFor, isothermalCompressionEnergy, refillEnergy } from '../../src/physics';
import { SPECS } from '../../src/data/specs';

describe('refill energy', () => {
  const air = gasFor('air');

  it('ideal isothermal compression of a full fill ≈ 35 kWh', () => {
    const j = isothermalCompressionEnergy(
      250,
      air,
      293,
      REFERENCE.pressure,
      REFERENCE.ambientPressure,
    );
    expect(j / 3.6e6).toBeGreaterThan(33);
    expect(j / 3.6e6).toBeLessThan(37);
  });

  it('a ~50 % efficient compressor needs 60–75 kWh', () => {
    const e = refillEnergy(
      250,
      air,
      293,
      REFERENCE.pressure,
      REFERENCE.ambientPressure,
      SPECS.compressorEfficiency.value,
    );
    expect(e.realisticKWh).toBeGreaterThan(60);
    expect(e.realisticKWh).toBeLessThan(75);
  });
});
