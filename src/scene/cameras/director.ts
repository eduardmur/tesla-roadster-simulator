/** Camera "shots" the tour and landing page use to put the camera on rails (no three.js import). */
import type { V3 } from '../../physics/math';

export type CameraShot =
  | { kind: 'chase' }
  | { kind: 'orbit'; radius: number; height: number; speed: number; fov?: number }
  /** Offset and look target in the car's frame (x left, y up, z forward), world-up camera. */
  | { kind: 'carFrame'; offset: V3; look: V3; fov?: number }
  | { kind: 'world'; position: V3; lookAt: V3 | 'car'; fov?: number };

/** The tour and landing page set this to override the user's camera mode. */
export const director: { shot: CameraShot | null; cut: boolean } = { shot: null, cut: false };
