import { beforeAll, describe, expect, it } from 'vitest';
import { SIXTY_MPH, buildVehicleParams, simulateLaunch, type TrimId } from '../../src/physics';
import { applyRampAssist } from '../../src/sim/assist';
import { JumpMonitor } from '../../src/sim/jump';
import { RAMP, curlAngleAt } from '../../src/sim/track';
import { NO_INPUT } from '../../src/sim/types';
import { Sim, loadRapier } from '../../src/sim/world';

beforeAll(async () => {
  await loadRapier();
});

function settle(sim: Sim, seconds = 2) {
  for (let i = 0; i < seconds * 120; i++) sim.step();
  sim.updateTelemetry();
}

describe('3D sim', () => {
  it('parks in front of the ramp, on its wheels, with the fans holding ~46 kN', () => {
    const sim = new Sim('rocket');
    settle(sim);
    const t = sim.telemetry;
    expect(t.wheelsInContact).toBe(4);
    expect(t.speed).toBeLessThan(0.1);
    expect(t.downforce).toBeGreaterThan(44_000);
    expect(t.position[2]).toBeLessThan(RAMP.z0);
    sim.dispose();
  });

  it.each(['performance', 'thrust', 'rocket'] as TrimId[])(
    '%s: 3D launch matches the 1D validation model within 3 %%',
    (trim) => {
      const sim = new Sim(trim);
      sim.reset('flat');
      settle(sim);
      sim.input = { ...sim.input, throttle: 1 };
      sim.autoThrustUntil = SIXTY_MPH;
      const t0 = sim.time;
      let time = Infinity;
      for (let i = 0; i < 600; i++) {
        sim.step();
        sim.updateTelemetry();
        if (sim.telemetry.forwardSpeed >= SIXTY_MPH) {
          time = sim.time - t0;
          break;
        }
      }
      const model = simulateLaunch(buildVehicleParams(trim), { fans: true, thrust: true }).time;
      expect(Math.abs(time - model) / model).toBeLessThan(0.03);
      sim.dispose();
    },
  );

  /** A player who only holds W (no steering, nothing in the air). */
  function holdW(sim: Sim, assist = true, maxSeconds = 60) {
    const monitor = new JumpMonitor();
    monitor.start(sim);
    sim.listeners.add((s, info) => monitor.onStep(s, info));
    let maxAngle = 0;
    let invertedAtExit = 0;
    for (let i = 0; i < 120 * maxSeconds && !monitor.result; i++) {
      sim.updateTelemetry();
      const t = sim.telemetry;
      if (t.surface === 'curl') maxAngle = Math.max(maxAngle, curlAngleAt(RAMP, t.position));
      if (monitor.stage === 'flight' && invertedAtExit === 0) invertedAtExit = t.upright;
      const input = { ...NO_INPUT, throttle: 1 };
      sim.input = assist ? applyRampAssist(input, t, RAMP) : input;
      sim.step();
    }
    return { result: monitor.result, maxAngle, invertedAtExit };
  }

  it('holding W climbs the curl, leaves it upside down, rolls and lands', () => {
    const sim = new Sim('rocket');
    const { result, maxAngle, invertedAtExit } = holdW(sim);
    expect(maxAngle * (180 / Math.PI)).toBeGreaterThan(165);
    expect(invertedAtExit).toBeLessThan(-0.9);
    expect(result?.success).toBe(true);
    expect(result!.reachedRamp).toBe(true);
    expect(result!.peakG).toBeLessThan(8);
    expect(result!.maxHeight).toBeGreaterThan(18);
    expect(sim.telemetry.tankMass).toBeGreaterThan(50);

    // After the landing the brakes hold it: it stops and does not creep or reverse.
    sim.holdBrake = true;
    let slowest = Infinity;
    for (let i = 0; i < 120 * 6; i++) {
      sim.input = NO_INPUT;
      sim.step();
      sim.updateTelemetry();
      slowest = Math.min(slowest, sim.telemetry.forwardSpeed);
    }
    expect(slowest).toBeGreaterThan(-0.1);
    expect(sim.telemetry.speed).toBeLessThan(0.1);
    sim.dispose();
  });

  it('without the ramp assist the same run is much harder (or fails)', () => {
    const soft = holdW(new Sim('rocket')).result!;
    const sim = new Sim('rocket');
    const hard = holdW(sim, false).result!;
    expect(!hard.success || hard.peakG > soft.peakG * 1.5).toBe(true);
    sim.dispose();
  });

  it('the assist only caps the speed toward the ramp: driving away is full throttle', () => {
    const sim = new Sim('rocket');
    sim.reset({ position: [RAMP.x, 0, -32], yaw: Math.PI });
    settle(sim, 1);
    for (let i = 0; i < 120 * 3; i++) {
      sim.updateTelemetry();
      sim.input = applyRampAssist({ ...NO_INPUT, throttle: 1 }, sim.telemetry, RAMP);
      sim.step();
    }
    sim.updateTelemetry();
    expect(sim.telemetry.forwardSpeed).toBeGreaterThan(30);
    sim.dispose();
  });

  it('without fans the car cannot stay on the ceiling part of the curl', () => {
    const sim = new Sim('rocket');
    sim.fansOn = false;
    expect(holdW(sim).result?.success).toBe(false);
    sim.dispose();
  });
});
