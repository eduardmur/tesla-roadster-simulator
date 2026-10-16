/**
 * Watches one run over the curl ramp: up, upside down, off the lip, roll, landing.
 * No rendering, so it can be tested headless.
 */
import { dot, toBody } from '../physics/math';
import { curlSpeeds } from './assist';
import { RAMP, curlAngleAt } from './track';
import type { Sim, StepInfo } from './world';

export type JumpStage =
  'ready' | 'approach' | 'climb' | 'inverted' | 'flight' | 'landed' | 'failed';

export interface JumpResult {
  success: boolean;
  headline: string;
  /** Angle between the car's up and world up at touchdown, degrees. */
  landingAngle: number;
  /** Peak acceleration in the half second after touchdown, g. */
  peakG: number;
  /** Air used from start to touchdown, kg. */
  airUsed: number;
  /** Highest point reached, m. */
  maxHeight: number;
  /** False when the car never got onto the ramp (it was just driven around). */
  reachedRamp: boolean;
}

const deg = (r: number) => (r * 180) / Math.PI;

export class JumpMonitor {
  stage: JumpStage = 'ready';
  result: JumpResult | null = null;
  private maxAngle = 0;
  private maxHeight = 0;
  private entrySpeed: number | null = null;
  private lipTime = 0;
  private touchdown: number | null = null;
  private landingAngle = 0;
  private peakG = 0;
  private airStart = 0;
  private airAtLanding = 0;
  private roofHit = false;
  private startTime = 0;

  start(sim: Sim): void {
    this.stage = 'ready';
    this.result = null;
    this.maxAngle = 0;
    this.maxHeight = 0;
    this.entrySpeed = null;
    this.touchdown = null;
    this.peakG = 0;
    this.roofHit = false;
    this.airStart = sim.tank?.mass ?? 0;
    this.startTime = sim.time;
  }

  onStep(sim: Sim, info: StepInfo): void {
    if (this.result) return;
    const p = info.pose.pos;
    const speed = Math.abs(dot(info.pose.linvel, info.pose.forward));
    this.maxHeight = Math.max(this.maxHeight, p[1]);
    if (this.stage === 'ready' && speed > 0.5) this.stage = 'approach';

    if (info.surface === 'curl') {
      this.entrySpeed ??= speed;
      this.maxAngle = Math.max(this.maxAngle, curlAngleAt(RAMP, p));
      if (this.stage === 'approach') this.stage = 'climb';
      if (this.maxAngle > (120 * Math.PI) / 180 && this.stage === 'climb') this.stage = 'inverted';
    }

    // Got some way up, then rolled back down onto the ground.
    if (
      this.stage === 'climb' &&
      info.surface === 'ground' &&
      !info.airborne &&
      this.maxAngle > (20 * Math.PI) / 180
    ) {
      this.finish(sim);
      return;
    }

    const onRamp = this.stage === 'climb' || this.stage === 'inverted';
    if (onRamp && info.airborne && p[1] > 2) {
      this.lipTime = sim.time;
      this.stage = this.maxAngle > (150 * Math.PI) / 180 ? 'flight' : 'failed';
    }

    if ((this.stage === 'flight' || this.stage === 'failed') && this.touchdown === null) {
      if (info.wheelContacts >= 2 && sim.time - this.lipTime > 0.3) {
        this.touchdown = sim.time;
        const up = toBody(info.pose.rot, [0, 1, 0]);
        this.landingAngle = Math.acos(Math.max(-1, Math.min(1, up[1])));
        this.airAtLanding = sim.tank?.mass ?? 0;
      }
      if (info.chassisTouching.includes('ground') && toBody(info.pose.rot, [0, 1, 0])[1] < 0.3) {
        this.roofHit = true;
      }
      if (sim.time - this.lipTime > 8) this.finish(sim);
    }

    if (this.touchdown !== null) {
      if (sim.time - this.touchdown < 0.5) {
        this.peakG = Math.max(this.peakG, Math.hypot(...info.specific) / sim.params.env.gravity);
      } else {
        this.finish(sim);
      }
      return;
    }

    // Never leave a run hanging: wandered off, drove past the ramp, or took far too long.
    if (this.stage === 'approach' || this.stage === 'climb') {
      const lost =
        sim.time - this.startTime > 90 ||
        Math.abs(p[0] - RAMP.x) > 25 ||
        p[2] > RAMP.z0 + RAMP.radius + 25;
      if (lost) this.finish(sim);
    }
  }

  private finish(sim: Sim): void {
    const g = sim.params.env.gravity;
    const landed =
      this.stage === 'flight' &&
      this.touchdown !== null &&
      !this.roofHit &&
      this.landingAngle < (45 * Math.PI) / 180;
    const entry = this.entrySpeed ?? 0;
    const tooFast = entry > curlSpeeds(RAMP).safeMax;
    let headline: string;
    if (landed && this.peakG > 8) headline = `Landed, but hard: ${Math.round(this.peakG)} g`;
    else if (landed) headline = 'Landed on its wheels';
    else if (tooFast) {
      const gs = Math.round((entry * entry) / RAMP.radius / g);
      headline = `Too fast: hit the ramp at ${Math.round(entry * 3.6)} km/h, about ${gs} g in the curve`;
    } else if (this.stage === 'failed') headline = `Fell off at ${Math.round(deg(this.maxAngle))}°`;
    else if (this.roofHit) headline = 'Landed on the roof';
    else headline = 'Didn’t make it up the ramp';
    this.stage = landed ? 'landed' : 'failed';
    this.result = {
      success: landed,
      headline,
      landingAngle: deg(this.landingAngle),
      peakG: this.peakG,
      airUsed:
        this.airStart - (this.touchdown !== null ? this.airAtLanding : (sim.tank?.mass ?? 0)),
      maxHeight: this.maxHeight,
      reachedRamp: this.entrySpeed !== null,
    };
  }
}
