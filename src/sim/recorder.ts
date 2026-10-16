/**
 * Fixed-capacity ring buffers: the 10-second scrub-back recorder and the telemetry history
 * the lab graphs draw from.
 */
import type { SuctionState } from '../physics/suction';
import type { TankState } from '../physics/tank';
import type { Quat, V3 } from '../physics/math';

export class Ring<T> {
  private items: (T | undefined)[];
  private head = 0;
  private count = 0;

  constructor(readonly capacity: number) {
    this.items = new Array<T | undefined>(capacity);
  }

  push(item: T): void {
    this.items[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    this.count = Math.min(this.count + 1, this.capacity);
  }

  get size(): number {
    return this.count;
  }

  /** i = 0 is the oldest item. */
  at(i: number): T | undefined {
    if (i < 0 || i >= this.count) return undefined;
    return this.items[(this.head - this.count + i + this.capacity * 2) % this.capacity];
  }

  last(): T | undefined {
    return this.at(this.count - 1);
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
  }

  /** Drop everything newer than index i (inclusive keeps i). */
  truncateAfter(i: number): void {
    if (i < 0) {
      this.clear();
      return;
    }
    const keep = Math.min(i + 1, this.count);
    this.head = (this.head - (this.count - keep) + this.capacity * 2) % this.capacity;
    this.count = keep;
  }

  toArray(): T[] {
    const out: T[] = [];
    for (let i = 0; i < this.count; i++) out.push(this.at(i)!);
    return out;
  }
}

export interface FlightSnapshot {
  rollActive: boolean;
  rollDir: 1 | -1;
  rollDone: number;
}

export interface CarSnapshot {
  time: number;
  stepIndex: number;
  pos: V3;
  rot: Quat;
  linvel: V3;
  angvel: V3;
  tank: TankState | null;
  suction: SuctionState;
  steer: number;
  compressions: number[];
  flight: FlightSnapshot;
  tiltAngle: number;
  airborneTime: number;
}

export interface HistorySample {
  t: number;
  pressure: number;
  temperature: number;
  mass: number;
  thrust: number;
  downforce: number;
  deltaP: number;
  speed: number;
  g: number;
  fanPower: number;
}

/** 10 s at 60 Hz. */
export const RECORDER_SECONDS = 10;
export const RECORDER_RATE = 60;
export const HISTORY_SECONDS = 30;
export const HISTORY_RATE = 30;
