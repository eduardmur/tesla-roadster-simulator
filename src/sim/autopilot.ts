/**
 * Autopilots that drive the real sim through the same input channel as the player:
 * the Curl demo ("Watch the autopilot do it"), launch control and a lane follower.
 */
import { dot, rotate, type V3 } from '../physics/math';
import type { CurlSpec } from './track';
import { NO_INPUT, type DriveInput, type Telemetry } from './types';

export interface LaneFollow {
  /** Lane centre (world x). */
  x: number;
  speed: number;
}

/** Steering that keeps the car on a lane running along world Z (works upside down on a curl). */
export function laneSteer(t: Telemetry, laneX: number): number {
  const left = rotate(t.orientation, [1, 0, 0]);
  const fwd = rotate(t.orientation, [0, 0, 1]);
  // On the run-in and the curl the body's left axis stays aligned with world ±X.
  const side = Math.sign(left[0]) || 1;
  const e = (t.position[0] - laneX) * side;
  const heading = dot(fwd, [1, 0, 0] as V3) * side;
  return Math.max(-1, Math.min(1, -0.25 * e - 2.2 * heading));
}

export function speedControl(speed: number, target: number): { throttle: number; brake: number } {
  const err = target - speed;
  return {
    throttle: Math.max(0, Math.min(1, err * 0.35)),
    brake: err < -3 ? Math.min(1, -err * 0.1) : 0,
  };
}

/** Safe run-in and climb speeds (m/s): slow enough that v²/R stays inside the suspension travel. */
export function curlSpeeds(curl: CurlSpec): { entry: number; climb: number } {
  return curl.radius > 8 ? { entry: 11, climb: 9 } : { entry: 9, climb: 7.5 };
}

/**
 * Ramp speed assist: while the car is on the ground, the throttle is capped (and the brakes
 * applied if needed) so it reaches the curl at a safe speed. Steering stays with the driver.
 */
export function applyRampAssist(input: DriveInput, t: Telemetry, curl: CurlSpec): DriveInput {
  if (t.airborne || input.throttle <= 0) return input;
  const s = curlSpeeds(curl);
  const ctl = speedControl(t.forwardSpeed, t.surface === 'curl' ? s.climb : s.entry);
  return {
    ...input,
    throttle: Math.min(input.throttle, ctl.throttle),
    brake: Math.max(input.brake, ctl.brake),
  };
}

export type CurlPhase = 'approach' | 'climb' | 'flight' | 'landed';

export interface CurlAutopilot {
  phase: CurlPhase;
  input(t: Telemetry): DriveInput;
}

/**
 * Drive up the curl at a steady speed, leave the lip, ask for a 180° roll and let the
 * landing assist do the braking burn.
 */
export function createCurlAutopilot(curl: CurlSpec): CurlAutopilot {
  // Slow and steady: suction holds the car on, and a slow entry keeps the
  // centripetal load (v²/R) inside the suspension travel.
  const { entry: entrySpeed, climb: climbSpeed } = curlSpeeds(curl);
  let rolled = false;
  let landedFor = 0;
  const ap: CurlAutopilot = {
    phase: 'approach',
    input(t) {
      const out: DriveInput = { ...NO_INPUT };
      const onCurl = t.surface === 'curl';
      if (ap.phase === 'approach' && onCurl) ap.phase = 'climb';
      if ((ap.phase === 'climb' || ap.phase === 'approach') && t.airborne && t.position[1] > 2) {
        ap.phase = 'flight';
      }
      if (ap.phase === 'flight' && !t.airborne && t.wheelsInContact >= 3) {
        landedFor += 1;
        if (landedFor > 20) ap.phase = 'landed';
      }

      switch (ap.phase) {
        case 'approach': {
          Object.assign(out, speedControl(t.forwardSpeed, entrySpeed));
          out.steer = laneSteer(t, curl.x);
          break;
        }
        case 'climb': {
          Object.assign(out, speedControl(t.forwardSpeed, climbSpeed));
          out.steer = laneSteer(t, curl.x);
          break;
        }
        case 'flight': {
          if (!rolled && t.upright < 0) {
            out.roll180 = true;
            rolled = true;
          }
          break;
        }
        case 'landed': {
          out.brake = 1;
          break;
        }
      }
      return out;
    },
  };
  return ap;
}
