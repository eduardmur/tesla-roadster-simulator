/**
 * Ramp speed assist: lets "hold W" finish the jump. Pure functions over telemetry, so the
 * same code runs in the browser and in the headless tests.
 */
import { rotate } from '../physics/math';
import type { CurlSpec } from './track';
import type { DriveInput, Telemetry } from './types';

export function speedControl(speed: number, target: number): { throttle: number; brake: number } {
  const err = target - speed;
  return {
    throttle: Math.max(0, Math.min(1, err * 0.35)),
    brake: err < -3 ? Math.min(1, -err * 0.1) : 0,
  };
}

/**
 * Run-in and climb speeds (m/s) that keep v²/R inside the suspension travel. On the reported
 * curl, entries up to ~70 km/h land reliably in the sim (with the climb held near 32 km/h);
 * from ~75 km/h the suspension bottoms out and the car bounces off. `safeMax` marks that edge.
 */
export function curlSpeeds(curl: CurlSpec): { entry: number; climb: number; safeMax: number } {
  return curl.radius > 8
    ? { entry: 16.5, climb: 9, safeMax: 19.5 }
    : { entry: 9, climb: 7.5, safeMax: 13 };
}

/**
 * While the car is heading for the curl (or on it), the throttle is capped (and the brakes
 * applied if needed) so it reaches the curl at a safe speed. Anywhere else the throttle is the
 * driver's. Steering always stays with the driver.
 */
export function applyRampAssist(input: DriveInput, t: Telemetry, curl: CurlSpec): DriveInput {
  if (t.airborne || input.throttle <= 0) return input;
  const onCurl = t.surface === 'curl';
  const [x, , z] = t.position;
  const headingIn =
    rotate(t.orientation, [0, 0, 1])[2] > 0.7 &&
    Math.abs(x - curl.x) < curl.width / 2 + 12 &&
    z < curl.z0 &&
    z > curl.z0 - 150;
  if (!onCurl && !headingIn) return input;
  const s = curlSpeeds(curl);
  const ctl = speedControl(t.forwardSpeed, onCurl ? s.climb : s.entry);
  return {
    ...input,
    throttle: Math.min(input.throttle, ctl.throttle),
    brake: Math.max(input.brake, ctl.brake),
  };
}
