import { beforeAll, describe, expect, it } from 'vitest';
import { SIXTY_MPH, buildVehicleParams, simulateLaunch, type TrimId } from '../../src/physics';
import { applyRampAssist, createCurlAutopilot, laneSteer } from '../../src/sim/autopilot';
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

  it('the autopilot climbs the curl, leaves it upside down, rolls and lands', () => {
    const sim = new Sim('rocket');
    const monitor = new JumpMonitor();
    monitor.start(sim);
    sim.listeners.add((s, info) => monitor.onStep(s, info));
    const ap = createCurlAutopilot(RAMP);
    let maxAngle = 0;
    let invertedAtExit = 0;
    for (let i = 0; i < 120 * 40 && !monitor.result; i++) {
      sim.updateTelemetry();
      sim.input = ap.input(sim.telemetry);
      sim.step();
      sim.updateTelemetry();
      const t = sim.telemetry;
      if (t.surface === 'curl') maxAngle = Math.max(maxAngle, curlAngleAt(RAMP, t.position));
      if (ap.phase === 'flight' && invertedAtExit === 0) invertedAtExit = t.upright;
    }
    expect(maxAngle * (180 / Math.PI)).toBeGreaterThan(165);
    expect(invertedAtExit).toBeLessThan(-0.9);
    expect(monitor.result?.success).toBe(true);
    expect(monitor.result!.peakG).toBeLessThan(6);
    expect(monitor.result!.maxHeight).toBeGreaterThan(18);
    expect(sim.telemetry.tankMass).toBeGreaterThan(50);
    sim.dispose();
  });

  function naiveRun(assist: boolean) {
    const sim = new Sim('rocket');
    const monitor = new JumpMonitor();
    monitor.start(sim);
    sim.listeners.add((s, info) => monitor.onStep(s, info));
    for (let i = 0; i < 120 * 70 && !monitor.result; i++) {
      sim.updateTelemetry();
      const t = sim.telemetry;
      // Naive player: full throttle, keeps it straight, no flying input (the assists do the rest).
      let input = {
        ...NO_INPUT,
        throttle: t.airborne ? 0 : 1,
        steer: t.airborne ? 0 : laneSteer(t, RAMP.x),
      };
      if (assist) input = applyRampAssist(input, t, RAMP);
      sim.input = input;
      sim.step();
    }
    sim.dispose();
    return monitor.result!;
  }

  it('a player who just holds W lands softly with the ramp assist, and much harder without it', () => {
    const soft = naiveRun(true);
    const hard = naiveRun(false);
    expect(soft.success).toBe(true);
    expect(soft.peakG).toBeLessThan(8);
    expect(hard.peakG).toBeGreaterThan(soft.peakG * 1.5);
  });

  it('without fans the car cannot stay on the ceiling part of the curl', () => {
    const sim = new Sim('rocket');
    sim.fansOn = false;
    const monitor = new JumpMonitor();
    monitor.start(sim);
    sim.listeners.add((s, info) => monitor.onStep(s, info));
    const ap = createCurlAutopilot(RAMP);
    for (let i = 0; i < 120 * 40 && !monitor.result; i++) {
      sim.updateTelemetry();
      sim.input = ap.input(sim.telemetry);
      sim.step();
    }
    expect(monitor.result?.success).toBe(false);
    sim.dispose();
  });
});
