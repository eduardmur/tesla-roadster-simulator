/**
 * The sim host: owns the Sim and runs the jump. "Launch" hands the car to the autopilot
 * (cinematic run); holding W drives it yourself, with the same safety assists on.
 */
import { applyRampAssist, createCurlAutopilot, type CurlAutopilot } from '../sim/autopilot';
import { JumpMonitor } from '../sim/jump';
import { RAMP } from '../sim/track';
import { NO_INPUT } from '../sim/types';
import type { Sim } from '../sim/world';
import { useApp } from '../state/store';
import { readDriveInput, wantsToDrive, type Action } from './input';

class Host {
  sim: Sim | null = null;
  private loading: Promise<Sim> | null = null;
  autopilot: CurlAutopilot | null = null;
  readonly monitor = new JumpMonitor();
  private reported = false;
  /** Scripted captures freeze real-time stepping and advance with stepFor(). */
  hold = false;

  /** Lazy-load Rapier + the sim (code-split). */
  load(onProgress?: (p: number, label: string) => void): Promise<Sim> {
    if (this.sim) return Promise.resolve(this.sim);
    this.loading ??= (async () => {
      onProgress?.(0.1, 'Loading physics');
      const mod = await import('../sim/world');
      onProgress?.(0.5, 'Starting physics');
      await mod.loadRapier();
      const sim = new mod.Sim('rocket');
      sim.listeners.add((s, info) => this.monitor.onStep(s, info));
      this.sim = sim;
      this.reset();
      onProgress?.(1, 'Ready');
      return sim;
    })();
    return this.loading;
  }

  /** Back to the start line, tanks full. */
  reset(): void {
    const sim = this.sim;
    if (!sim) return;
    sim.reset('start');
    this.autopilot = null;
    this.monitor.start(sim);
    this.reported = false;
    useApp.getState().set({ mode: 'idle', stage: 'ready', result: null });
  }

  /** Hand the car to the autopilot for the jump (from the start line). */
  launch(): void {
    const sim = this.sim;
    if (!sim) return;
    if (useApp.getState().mode !== 'idle') this.reset();
    this.autopilot = createCurlAutopilot(RAMP);
    useApp.getState().set({ mode: 'auto' });
  }

  onAction = (a: Action): void => {
    const app = useApp.getState();
    if (app.articleOpen || app.load.stage !== 'ready') return;
    if (a === 'reset') this.reset();
    else if (app.mode === 'idle' || app.mode === 'done') this.launch();
  };

  /** Called by the scene every frame. */
  frame(dt: number): void {
    const sim = this.sim;
    if (!sim) return;
    const app = useApp.getState();
    sim.paused = app.articleOpen || this.hold;

    if (app.mode === 'idle' && wantsToDrive()) app.set({ mode: 'manual' });
    const mode = useApp.getState().mode;
    if (mode === 'auto' && this.autopilot) {
      sim.updateTelemetry();
      sim.input = this.autopilot.input(sim.telemetry);
    } else if (mode === 'manual') {
      // Assists stay on: W means "go at a safe speed" on the ramp; the flight computer does the rest.
      sim.input = applyRampAssist(readDriveInput(this.onAction), sim.telemetry, RAMP);
    } else {
      readDriveInput(this.onAction);
      sim.input = { ...NO_INPUT, brake: mode === 'done' ? 1 : 0 };
    }
    sim.advance(dt);
    this.syncStage();
  }

  /** Advance n fixed steps with the current driver (used by scripted captures). */
  stepFor(n: number): void {
    const sim = this.sim;
    if (!sim) return;
    for (let i = 0; i < n; i++) {
      sim.updateTelemetry();
      if (this.autopilot) sim.input = this.autopilot.input(sim.telemetry);
      sim.step();
    }
    sim.updateTelemetry();
    this.syncStage();
  }

  private syncStage(): void {
    const app = useApp.getState();
    const m = this.monitor;
    if (m.stage !== app.stage) app.set({ stage: m.stage });
    if (m.result && !this.reported) {
      this.reported = true;
      app.set({ mode: 'done', result: m.result });
    }
  }
}

export const host = new Host();
