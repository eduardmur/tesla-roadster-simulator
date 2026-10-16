/** Keyboard/gamepad actions → app state. */
import { useApp } from '../state/store';
import type { Action } from '../ui/controls/input';
import { host } from './host';
import { announce } from './captions';

export function onAction(a: Action): void {
  const app = useApp.getState();
  if (app.mode === 'landing') return;
  switch (a) {
    case 'fans':
      app.toggle('fansOn');
      announce(
        useApp.getState().fansOn ? 'Fans on: suction building' : 'Fans off: suction collapsing',
      );
      break;
    case 'xray':
      app.toggle('xray');
      break;
    case 'pause':
      if (app.scrub !== null) {
        host.cancelScrub();
        app.set({ scrub: null, paused: false });
      } else app.toggle('paused');
      break;
    case 'camera':
      app.cycleCamera();
      break;
    case 'restart':
      host.restartChallenge();
      break;
    case 'lab':
      app.toggle('labOpen');
      break;
    case 'hideUi':
      app.toggle('hideUi');
      announce(useApp.getState().hideUi ? 'UI hidden. Press H to show it again.' : 'UI shown');
      break;
    case 'escape':
      if (app.hideUi) app.set({ hideUi: false });
      else if (app.hotspot) app.set({ hotspot: null });
      else if (app.labOpen) app.set({ labOpen: false });
      else if (app.specsOpen || app.settingsOpen)
        app.set({ specsOpen: false, settingsOpen: false });
      break;
    case 'roll180':
      announce('Roll 180° requested');
      break;
  }
}
