/**
 * The sim host: owns the Sim instance and wires it to app state, input, challenges,
 * the autopilot demo / ghost and the tour. The 3D scene calls `host.frame(dt)` once per frame.
 */
import { CURLS, type SpawnId } from '../sim/track';
import { createCurlAutopilot, type CurlAutopilot } from '../sim/autopilot';
import {
  createChallenge,
  type Challenge,
  type ChallengeKind,
  type ChallengeResult,
} from '../sim/challenges';
import { NO_INPUT, type DriveInput } from '../sim/types';
import type { Sim, StepInfo } from '../sim/world';
import { readDriveInput, type Action } from '../ui/controls/input';
import { storage, useApp } from '../state/store';
import type { Quat, V3 } from '../physics/math';
import type { CarSnapshot } from '../sim/recorder';
import type { DemoAction } from '../data/components';

export interface GhostFrame {
  t: number;
  pos: V3;
  rot: Quat;
}

export type InputOverride = (sim: Sim) => DriveInput;

type Listener = () => void;

class Host {
  sim: Sim | null = null;
  private loading: Promise<Sim> | null = null;
  challenge: Challenge | null = null;
  lastResult: ChallengeResult | null = null;
  autopilot: CurlAutopilot | null = null;
  /** Recorded autopilot run, replayed as a translucent ghost on "Your turn". */
  ghost: GhostFrame[] | null = null;
  ghostVisible = false;
  private ghostRecording: GhostFrame[] | null = null;
  private ghostStart = 0;
  /** Tour chapters can drive the car or constrain input. */
  inputOverride: InputOverride | null = null;
  stepHooks = new Set<(sim: Sim, info: StepInfo) => void>();
  private listeners = new Set<Listener>();
  private spawn: SpawnId = 'hub';
  launchControl = true;

  /** Lazy-load Rapier + the sim module (code-split). */
  load(onProgress?: (p: number, label: string) => void): Promise<Sim> {
    if (this.sim) return Promise.resolve(this.sim);
    this.loading ??= (async () => {
      onProgress?.(0.1, 'Loading physics engine (WASM)…');
      const mod = await import('../sim/world');
      onProgress?.(0.5, 'Starting physics…');
      await mod.loadRapier();
      onProgress?.(0.85, 'Building the test pad…');
      const { trim, whatIf } = useApp.getState();
      const sim = new mod.Sim(trim, whatIf);
      sim.listeners.add((s, info) => this.onStep(s, info));
      this.sim = sim;
      this.syncFromStore();
      useApp.subscribe((state, prev) => {
        if (state.trim !== prev.trim || state.whatIf !== prev.whatIf) {
          sim.setVehicle(state.trim, state.whatIf);
          this.emit();
        }
        if (state.fansOn !== prev.fansOn || state.assists !== prev.assists) this.syncFromStore();
      });
      onProgress?.(1, 'Ready');
      this.emit();
      return sim;
    })();
    return this.loading;
  }

  private syncFromStore(): void {
    const s = useApp.getState();
    if (!this.sim) return;
    this.sim.fansOn = s.fansOn;
    this.sim.assists = { ...s.assists };
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  /** Called by the scene every frame. */
  frame(dt: number, onAction: (a: Action) => void): void {
    const sim = this.sim;
    if (!sim) return;
    const app = useApp.getState();
    sim.paused = app.paused || app.scrub !== null;
    sim.timeScale = app.timeScale;

    let input: DriveInput;
    if (this.autopilot) {
      sim.updateTelemetry();
      input = this.autopilot.input(sim.telemetry);
    } else if (this.inputOverride) {
      input = this.inputOverride(sim);
    } else {
      input = readDriveInput(sim.telemetry.airborne, onAction);
    }
    if (this.challenge?.phase === 'done') input = { ...NO_INPUT, brake: 1 };
    sim.input = input;
    sim.advance(dt);
  }

  private onStep(sim: Sim, info: StepInfo): void {
    this.challenge?.onStep(sim, info);
    if (
      this.challenge?.phase === 'done' &&
      this.challenge.result &&
      this.lastResult !== this.challenge.result
    ) {
      this.lastResult = this.challenge.result;
      this.saveBest(this.challenge.result);
      this.emit();
    }
    if (this.ghostRecording && sim.stepIndex % 4 === 0) {
      this.ghostRecording.push({
        t: sim.time - this.ghostStart,
        pos: info.pose.pos,
        rot: info.pose.rot,
      });
    }
    // The autopilot run becomes the ghost as soon as its result is in.
    if (this.ghostRecording && this.challenge?.phase === 'done') {
      this.ghost = this.ghostRecording;
      this.ghostRecording = null;
      this.emit();
    }
    for (const h of this.stepHooks) h(sim, info);
  }

  respawn(spawn: SpawnId = this.spawn): void {
    this.spawn = spawn;
    this.sim?.reset(spawn);
    this.emit();
  }

  startChallenge(kind: ChallengeKind): void {
    const sim = this.sim;
    if (!sim) return;
    this.stopAutopilot();
    const { trim } = useApp.getState();
    this.challenge = createChallenge(kind, trim, this.launchControl);
    this.lastResult = null;
    this.spawn = this.challenge.spawn;
    this.challenge.start(sim);
    this.ghostVisible =
      (kind === 'curl' || kind === 'practice') && !!this.ghost && this.ghostKind === kind;
    if (this.ghostVisible) this.ghostStart = sim.time;
    useApp.getState().set({ challenge: kind, paused: false, scrub: null });
    this.emit();
  }

  restartChallenge(): void {
    if (this.challenge) this.startChallenge(this.challenge.kind);
    else this.respawn();
  }

  stopChallenge(): void {
    this.challenge = null;
    this.lastResult = null;
    this.ghostVisible = false;
    this.stopAutopilot();
    useApp.getState().set({ challenge: null });
    this.emit();
  }

  private ghostKind: 'curl' | 'practice' | null = null;

  /** "Watch the autopilot do it": the real car drives itself; the run becomes the ghost. */
  watchAutopilot(kind: 'curl' | 'practice'): void {
    const sim = this.sim;
    if (!sim) return;
    useApp.getState().set({ trim: 'rocket', paused: false, scrub: null });
    sim.setVehicle('rocket', useApp.getState().whatIf);
    this.challenge = createChallenge(kind, 'rocket');
    this.lastResult = null;
    this.challenge.start(sim);
    this.autopilot = createCurlAutopilot(CURLS[kind]);
    this.ghostRecording = [];
    this.ghostKind = kind;
    this.ghostStart = sim.time;
    this.ghostVisible = false;
    useApp.getState().set({ challenge: kind });
    this.emit();
  }

  get autopilotActive(): boolean {
    return !!this.autopilot;
  }

  stopAutopilot(): void {
    this.autopilot = null;
    this.ghostRecording = null;
  }

  /** Ghost pose at the current challenge time. */
  ghostPose(): GhostFrame | null {
    if (!this.ghostVisible || !this.ghost || !this.sim || this.ghost.length === 0) return null;
    const t = this.sim.time - this.ghostStart;
    const g = this.ghost;
    let lo = 0;
    let hi = g.length - 1;
    if (t >= g[hi]!.t) return g[hi]!;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (g[mid]!.t <= t) lo = mid;
      else hi = mid;
    }
    const a = g[lo]!;
    const b = g[hi]!;
    const k = (t - a.t) / Math.max(b.t - a.t, 1e-6);
    return {
      t,
      pos: [
        a.pos[0] + (b.pos[0] - a.pos[0]) * k,
        a.pos[1] + (b.pos[1] - a.pos[1]) * k,
        a.pos[2] + (b.pos[2] - a.pos[2]) * k,
      ],
      rot: k < 0.5 ? a.rot : b.rot,
    };
  }

  /** Newest recorded snapshot when scrubbing started ("now"). */
  private scrubLive: CarSnapshot | null = null;

  /** Scrub-back: show the state `secondsBack` before "now" (sim is paused while scrubbing). */
  scrubTo(secondsBack: number): void {
    const sim = this.sim;
    if (!sim || sim.recorder.size === 0) return;
    this.scrubLive ??= sim.recorder.last()!;
    const target = this.scrubLive.time - secondsBack;
    let pick = sim.recorder.at(0)!;
    for (let i = 0; i < sim.recorder.size; i++) {
      const s = sim.recorder.at(i)!;
      if (s.time <= target) pick = s;
    }
    sim.restore(pick, false);
    this.emit();
  }

  /** Continue the run from the scrubbed moment (the old future is discarded). */
  commitScrub(): void {
    if (this.sim) this.sim.forgetAfter(this.sim.time);
    this.scrubLive = null;
    this.emit();
  }

  /** Jump back to "now". */
  cancelScrub(): void {
    if (this.sim && this.scrubLive) this.sim.restore(this.scrubLive, false);
    this.scrubLive = null;
    this.emit();
  }

  /** Seconds of history available for scrubbing. */
  get scrubRange(): number {
    const r = this.sim?.recorder;
    if (!r || r.size < 2) return 0;
    const live = this.scrubLive ?? r.last()!;
    return Math.max(0, live.time - r.at(0)!.time);
  }

  /** "See it work": run one subsystem in isolation for a few seconds. */
  runDemo(action: DemoAction): void {
    const sim = this.sim;
    if (!sim) return;
    this.stopAutopilot();
    const t0 = sim.time;
    const app = useApp.getState();
    app.set({ paused: false, scrub: null });
    const restoreFans = app.fansOn;
    if (action === 'launch-tires') {
      this.respawn('drag');
      app.set({ fansOn: false });
    }
    if (action === 'fans') app.set({ fansOn: false });
    const end = (dur: number) => sim.time - t0 > dur;
    let done = false;
    const finish = () => {
      done = true;
      this.inputOverride = null;
      sim.holdBrake = false;
      if (action === 'launch-tires' || action === 'fans')
        useApp.getState().set({ fansOn: restoreFans });
    };
    this.inputOverride = (s) => {
      const t = s.time - t0;
      const i: DriveInput = { ...NO_INPUT };
      switch (action) {
        case 'rear-burst':
          s.holdBrake = t < 1.6;
          i.thrust = t < 1 ? 1 : 0;
          if (end(2)) finish();
          break;
        case 'pwm':
          s.holdBrake = t < 2.6;
          i.thrust = t < 2.5 ? 0.3 : 0;
          if (end(3)) finish();
          break;
        case 'lift-burst':
          i.lift = t < 0.7 ? 1 : 0;
          if (end(5)) finish();
          break;
        case 'skirts':
          i.lift = t < 0.25 ? 0.6 : 0;
          if (end(3)) finish();
          break;
        case 'yaw-burst':
          i.lift = t < 1.4 ? 0.45 : 0;
          i.yaw = t > 0.3 && t < 1.3 ? 1 : 0;
          if (end(5)) finish();
          break;
        case 'roll':
          i.lift = t < 0.9 ? 1 : 0;
          i.roll180 = t > 0.9 && t < 1.0;
          if (end(6)) finish();
          break;
        case 'fans':
          if (t > 1.5) useApp.getState().set({ fansOn: true });
          if (end(4)) finish();
          break;
        case 'launch-tires':
          i.throttle = t < 3 ? 1 : 0;
          i.brake = t >= 3 ? 1 : 0;
          if (end(5)) finish();
          break;
      }
      return done ? { ...NO_INPUT } : i;
    };
  }

  best(kind: ChallengeKind, trim: string): { score: number; label: string } | null {
    return storage.get<{ score: number; label: string } | null>(`best:${kind}:${trim}`, null);
  }

  private saveBest(r: ChallengeResult): void {
    if (!r.success || this.autopilot) return;
    const trim = useApp.getState().trim;
    const prev = this.best(r.kind, trim);
    const better = !prev || (r.lowerIsBetter ? r.score < prev.score : r.score > prev.score);
    if (better) storage.set(`best:${r.kind}:${trim}`, { score: r.score, label: r.scoreLabel });
  }
}

export const host = new Host();
