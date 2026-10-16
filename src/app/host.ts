/**
 * The sim host: owns the Sim and runs the jump. You drive (W, or the pedal on touch screens);
 * the ramp assist keeps the speed safe and the flight computer rolls and lands the car. After
 * a run the car stops and waits; a fresh drive input takes over from wherever it is.
 */
import { applyRampAssist } from '../sim/assist';
import { JumpMonitor } from '../sim/jump';
import { RAMP } from '../sim/track';
import { NO_INPUT, type DriveInput } from '../sim/types';
import type { Sim } from '../sim/world';
import { useApp } from '../state/store';
import { readDriveInput, type Action } from './input';

const noAction = () => {};

class Host {
  sim: Sim | null = null;
  private loading: Promise<Sim> | null = null;
  readonly monitor = new JumpMonitor();
  private reported = false;
  /** Drive input was released since the last run ended (so a held key doesn't skip the result). */
  private released = true;
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

  /** Back to the start line in front of the ramp, tanks full. */
  reset(): void {
    const sim = this.sim;
    if (!sim) return;
    sim.reset('start');
    this.monitor.start(sim);
    this.reported = false;
    useApp.getState().set({ mode: 'idle', stage: 'ready', result: null });
  }

  onAction = (a: Action): void => {
    const app = useApp.getState();
    if (app.articleOpen || app.load.stage !== 'ready') return;
    if (a === 'reset' || app.mode === 'done') this.reset();
  };

  /** Called by the scene every frame. */
  frame(dt: number): void {
    const sim = this.sim;
    if (!sim) return;
    const app = useApp.getState();
    sim.paused = app.articleOpen || this.hold;
    sim.input = this.driverInput(readDriveInput(this.onAction));
    sim.advance(dt);
    this.syncStage();
  }

  /** Advance n fixed steps with the current controls (used by scripted captures and tests). */
  stepFor(n: number): void {
    const sim = this.sim;
    if (!sim) return;
    const drive = readDriveInput(noAction);
    for (let i = 0; i < n; i++) {
      sim.input = this.driverInput(drive);
      sim.step();
      this.syncStage();
    }
    sim.updateTelemetry();
  }

  /** Turn the player's controls into the sim input for the current mode. */
  private driverInput(drive: DriveInput): DriveInput {
    const sim = this.sim!;
    const app = useApp.getState();
    const wants = drive.throttle > 0 || drive.brake > 0 || drive.steer !== 0;
    if (!wants) this.released = true;
    const canTakeOver = app.mode === 'idle' || (app.mode === 'done' && this.released);
    if (wants && canTakeOver && !app.articleOpen) this.takeOver();
    const mode = useApp.getState().mode;
    // After a run the brakes hold the car still (brake input alone would mean reverse once stopped).
    sim.holdBrake = mode === 'done';
    if (mode !== 'manual') return NO_INPUT;
    // W means "go at a safe speed" toward the ramp; the flight computer does the rest.
    sim.updateTelemetry();
    return applyRampAssist(drive, sim.telemetry, RAMP);
  }

  /** The player takes the wheel: from the start line, or from wherever the last run ended. */
  private takeOver(): void {
    const sim = this.sim;
    if (!sim) return;
    const app = useApp.getState();
    if (app.mode === 'done') {
      this.monitor.start(sim);
      this.reported = false;
    }
    app.set({ mode: 'manual', result: null, stage: this.monitor.stage });
  }

  private syncStage(): void {
    const app = useApp.getState();
    const m = this.monitor;
    if (m.result && !this.reported) {
      // Just driving around, nowhere near the ramp: nothing to judge, keep watching.
      if (!m.result.reachedRamp && this.sim) m.start(this.sim);
      else {
        this.reported = true;
        this.released = false;
        app.set({ mode: 'done', result: m.result });
      }
    }
    if (m.stage !== app.stage) app.set({ stage: m.stage });
  }
}

export const host = new Host();
