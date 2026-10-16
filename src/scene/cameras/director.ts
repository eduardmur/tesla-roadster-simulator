/** Camera override for scripted captures (the media script); no three.js import. */
import type { V3 } from '../../physics/math';

export type CameraShot = { kind: 'world'; position: V3; lookAt: V3 | 'car'; fov?: number };

/** Set by the media script to put the camera on a fixed spot; `cut` skips the easing. */
export const director: { shot: CameraShot | null; cut: boolean } = { shot: null, cut: false };
