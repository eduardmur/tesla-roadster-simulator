import { describe, expect, it } from 'vitest';
import { buildVehicleParams, simulateLaunch, type TrimId } from '../../src/physics';
import { SPECS } from '../../src/data/specs';

const claims: Record<TrimId, number> = {
  performance: SPECS.perfZeroToSixty.value,
  thrust: SPECS.thrustZeroToSixty.value,
  rocket: SPECS.rocketZeroToSixty.value,
};

describe('0–60 mph with default parameters', () => {
  it.each(Object.entries(claims) as [TrimId, number][])(
    '%s is under its claimed time and within −15 %%/+0 %%',
    (trim, claim) => {
      const r = simulateLaunch(buildVehicleParams(trim), { fans: true, thrust: true });
      expect(r.time).toBeLessThanOrEqual(claim);
      expect(r.time).toBeGreaterThanOrEqual(claim * 0.85);
    },
  );

  it('tires alone (fans and thrusters off) are grip-limited at ≈ 1.26 g', () => {
    const r = simulateLaunch(buildVehicleParams('performance'), { fans: false, thrust: false });
    expect(r.gripLimitedAtLaunch).toBe(true);
    expect(r.time).toBeGreaterThan(2.0);
    expect(r.time).toBeLessThan(2.4);
  });

  it('with fans on the motors, not the tires, become the limit', () => {
    const r = simulateLaunch(buildVehicleParams('performance'), { fans: true, thrust: false });
    expect(r.gripLimitedAtLaunch).toBe(false);
  });

  it('the Thrust trim spends less than its whole 200 L tank on one launch', () => {
    const vp = buildVehicleParams('thrust');
    const r = simulateLaunch(vp, { fans: true, thrust: true });
    expect(r.airUsed).toBeGreaterThan(10);
    expect(r.airUsed).toBeLessThan(vp.tankFull!.mass);
  });
});
