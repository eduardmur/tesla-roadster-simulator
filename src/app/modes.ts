import { useApp, type Mode } from '../state/store';
import { host } from './host';

/** Switch between landing, tour and drive ("Look inside" = drive with X-ray and the lab open). */
export function enterMode(mode: Mode, opts: { inside?: boolean } = {}): void {
  const app = useApp.getState();
  host.stopChallenge();
  if (mode === 'drive') {
    app.set({
      mode: 'drive',
      xray: !!opts.inside,
      labOpen: !!opts.inside,
      labTab: opts.inside ? 'telemetry' : app.labTab,
      camera: opts.inside ? 'orbit' : 'chase',
      paused: false,
      scrub: null,
    });
    host.respawn('hub');
  } else {
    app.set({ mode, xray: false, labOpen: false, paused: false, scrub: null, camera: 'chase' });
  }
}
