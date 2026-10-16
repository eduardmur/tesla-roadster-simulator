/**
 * Keyboard and gamepad input. Space/Enter launches (or runs again), R resets,
 * W/A/S/D or arrows drive it yourself.
 */
import { NO_INPUT, type DriveInput } from '../sim/types';

export type Action = 'launch' | 'reset';

const DRIVE_CODES = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

export const keys = new Set<string>();
let lastButtons: boolean[] = [];

function isField(t: EventTarget | null): boolean {
  return (
    t instanceof HTMLElement &&
    (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
  );
}

/** Attach keyboard listeners; returns a detach function. */
export function attachKeyboard(onAction: (a: Action) => void, enabled: () => boolean): () => void {
  const down = (e: KeyboardEvent) => {
    if (!enabled() || isField(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    const onButton = e.target instanceof HTMLElement && e.target.tagName === 'BUTTON';
    if (DRIVE_CODES.has(e.code)) {
      keys.add(e.code);
      e.preventDefault();
    } else if ((e.code === 'Space' || e.code === 'Enter') && !onButton && !e.repeat) {
      e.preventDefault();
      onAction('launch');
    } else if (e.code === 'KeyR' && !e.repeat) {
      onAction('reset');
    }
  };
  const up = (e: KeyboardEvent) => keys.delete(e.code);
  const blur = () => keys.clear();
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', blur);
  };
}

/** True while the player is holding a drive key or stick. */
export function wantsToDrive(): boolean {
  return keys.size > 0;
}

/** Read the keyboard (and the first gamepad, standard mapping) into a DriveInput. */
export function readDriveInput(onAction: (a: Action) => void): DriveInput {
  const has = (...codes: string[]) => codes.some((c) => keys.has(c));
  const input: DriveInput = {
    ...NO_INPUT,
    throttle: has('KeyW', 'ArrowUp') ? 1 : 0,
    brake: has('KeyS', 'ArrowDown') ? 1 : 0,
    steer: (has('KeyA', 'ArrowLeft') ? 1 : 0) - (has('KeyD', 'ArrowRight') ? 1 : 0),
  };
  let pads: (Gamepad | null)[] = [];
  try {
    pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
  } catch {
    /* no gamepad API */
  }
  const gp = pads.find((p): p is Gamepad => !!p && p.connected);
  if (gp) {
    const pressed = gp.buttons.map((b) => b.pressed);
    if (pressed[0] && !lastButtons[0]) onAction('launch');
    if (pressed[3] && !lastButtons[3]) onAction('reset');
    lastButtons = pressed;
    const lx = gp.axes[0] ?? 0;
    input.throttle = Math.max(input.throttle, gp.buttons[7]?.value ?? 0);
    input.brake = Math.max(input.brake, gp.buttons[6]?.value ?? 0);
    if (Math.abs(lx) > 0.12) input.steer = Math.max(-1, Math.min(1, input.steer - lx));
  }
  return input;
}
