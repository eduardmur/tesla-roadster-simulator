import { beforeAll, describe, expect, it } from 'vitest';
import {
  SIXTY_MPH,
  buildVehicleParams,
  reportedWhatIf,
  simulateLaunch,
  type TrimId,
} from '../../src/physics';
import { applyRampAssist, createCurlAutopilot, laneSteer } from '../../src/sim/autopilot';
import { createCurl } from '../../src/sim/challenges';
import { NO_INPUT } from '../../src/sim/types';
import { CURLS, curlAngleAt, type CurlSpec } from '../../src/sim/track';
import { Sim, loadRapier } from '../../src/sim/world';

beforeAll(async () => {
  await loadRapier();
});

function settle(sim: Sim, seconds = 2) {
  for (let i = 0; i < seconds * 120; i++) sim.step();
  sim.updateTelemetry();
}

describe('3D sim', () => {
  it('rests on its wheels with the fans holding ~46 kN', () => {
    const sim = new Sim('performance');
    sim.reset('drag');
    settle(sim);
    const t = sim.telemetry;
    expect(t.wheelsInContact).toBe(4);
    expect(t.speed).toBeLessThan(0.1);
    expect(t.downforce).toBeGreaterThan(44_000);
    expect(t.gVert).toBeCloseTo(1, 1);
    sim.dispose();
  });

  it.each(['performance', 'thrust', 'rocket'] as TrimId[])(
    '%s: 3D launch matches the 1D validation model within 3 %%',
    (trim) => {
      const sim = new Sim(trim);
      sim.reset('drag');
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

  it.each([CURLS.curl, CURLS.practice] as CurlSpec[])('the autopilot completes $label', (curl) => {
    const sim = new Sim('rocket');
    sim.reset(curl.id);
    const ap = createCurlAutopilot(curl);
    let maxAngle = 0;
    let invertedAtExit = 0;
    let peakLandingG = 0;
    for (let i = 0; i < 120 * 40; i++) {
      sim.updateTelemetry();
      sim.input = ap.input(sim.telemetry);
      sim.step();
      sim.updateTelemetry();
      const t = sim.telemetry;
      if (t.surface === curl.id) maxAngle = Math.max(maxAngle, curlAngleAt(curl, t.position));
      if (ap.phase === 'flight' && invertedAtExit === 0) invertedAtExit = t.upright;
      if (ap.phase === 'flight' || ap.phase === 'landed')
        peakLandingG = Math.max(peakLandingG, t.gTotal);
      if (ap.phase === 'landed' && t.speed < 1) break;
    }
    const t = sim.telemetry;
    expect(maxAngle * (180 / Math.PI)).toBeGreaterThan(165);
    expect(invertedAtExit).toBeLessThan(-0.9);
    expect(ap.phase).toBe('landed');
    expect(t.upright).toBeGreaterThan(0.95);
    expect(peakLandingG).toBeLessThan(6);
    expect(t.tankMass).toBeGreaterThan(50);
    sim.dispose();
  });

  it.each([
    [true, true],
    [false, false],
  ])('a player who just holds W: ramp assist %s → completes %s', (assist, completes) => {
    const curl = CURLS.curl;
    const sim = new Sim('rocket');
    const ch = createCurl('curl');
    ch.start(sim);
    sim.listeners.add((s, info) => ch.onStep(s, info));
    for (let i = 0; i < 120 * 70 && ch.phase !== 'done'; i++) {
      sim.updateTelemetry();
      const t = sim.telemetry;
      // Naive player: full throttle, keeps it straight, no flying input (assists do the rest).
      let input = {
        ...NO_INPUT,
        throttle: t.airborne ? 0 : 1,
        steer: t.airborne ? 0 : laneSteer(t, curl.x),
      };
      if (assist) input = applyRampAssist(input, t, curl);
      sim.input = input;
      sim.step();
    }
    expect(ch.phase).toBe('done');
    expect(ch.result!.success).toBe(completes);
    if (!completes) expect(ch.result!.headline).toMatch(/Too fast/);
    sim.dispose();
  });

  it('suction keeps the car on the tilt rig when it turns into a ceiling', () => {
    const sim = new Sim('performance');
    sim.reset('tilt');
    settle(sim, 1);
    sim.tiltTarget = Math.PI;
    for (let i = 0; i < 120 * 10; i++) sim.step();
    sim.updateTelemetry();
    const t = sim.telemetry;
    expect(t.wheelsInContact).toBe(4);
    expect(t.upright).toBeLessThan(-0.95);
    expect(t.surface).toBe('tilt-rig');
    sim.dispose();
  });

  it('without fans the car falls off the rig at the wall', () => {
    const sim = new Sim('performance');
    sim.reset('tilt');
    sim.fansOn = false;
    settle(sim, 1);
    sim.tiltTarget = Math.PI / 2;
    for (let i = 0; i < 120 * 8; i++) sim.step();
    sim.updateTelemetry();
    expect(sim.telemetry.position[1]).toBeLessThan(3);
    sim.dispose();
  });

  // Rapier keeps internal contact caches we cannot restore, so replays agree closely, not bit-exactly.
  it('scrub-back restore replays the same run within centimetres', () => {
    const sim = new Sim('rocket', reportedWhatIf());
    sim.reset('hub');
    settle(sim, 1);
    sim.input = { ...sim.input, throttle: 1, steer: 0.3 };
    for (let i = 0; i < 120; i++) sim.step();
    const snap = sim.snapshot();
    sim.input = { ...sim.input, thrust: 1 };
    for (let i = 0; i < 240; i++) sim.step();
    const a = sim.snapshot();
    sim.restore(snap);
    for (let i = 0; i < 240; i++) sim.step();
    const b = sim.snapshot();
    const travelled = Math.hypot(
      a.pos[0] - snap.pos[0],
      a.pos[1] - snap.pos[1],
      a.pos[2] - snap.pos[2],
    );
    expect(travelled).toBeGreaterThan(50);
    const diff = Math.hypot(b.pos[0] - a.pos[0], b.pos[1] - a.pos[1], b.pos[2] - a.pos[2]);
    expect(diff / travelled).toBeLessThan(0.002);
    expect(Math.abs(b.tank!.mass - a.tank!.mass)).toBeLessThan(0.1);
    sim.dispose();
  });
});
