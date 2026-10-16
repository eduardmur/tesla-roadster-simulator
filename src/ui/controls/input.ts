/**
 * Keyboard, gamepad and touch input, merged into one DriveInput per frame.
 *
 * Keyboard: WASD/arrows drive (in the air: W/S pitch, A/D roll), Space = rear thrust,
 * Shift = lift, Q/E = yaw, R = roll 180°, F = fans, X = X-ray, P = pause, C = camera.
 */
import { NO_INPUT, type DriveInput } from '../../sim/types';

export type Action =
  'fans' | 'xray' | 'pause' | 'camera' | 'roll180' | 'restart' | 'escape' | 'lab' | 'hideUi';

const DRIVE_CODES = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'ShiftLeft',
  'ShiftRight',
  'KeyQ',
  'KeyE',
]);

const ACTION_CODES: Record<string, Action> = {
  KeyF: 'fans',
  KeyX: 'xray',
  KeyP: 'pause',
  KeyC: 'camera',
  KeyR: 'roll180',
  KeyT: 'restart',
  Escape: 'escape',
  KeyL: 'lab',
  KeyH: 'hideUi',
};

export interface TouchState {
  stickX: number;
  stickY: number;
  thrust: boolean;
  lift: boolean;
  brake: boolean;
  active: boolean;
}

export const controls = {
  keys: new Set<string>(),
  touch: {
    stickX: 0,
    stickY: 0,
    thrust: false,
    lift: false,
    brake: false,
    active: false,
  } as TouchState,
  rollRequest: false,
  lastGamepadButtons: [] as boolean[],
  enabled: true,
};

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}

function isActivatable(t: EventTarget | null): boolean {
  return (
    t instanceof HTMLElement &&
    (t.tagName === 'BUTTON' || t.tagName === 'A' || t.getAttribute('role') === 'button')
  );
}

/** Attach keyboard listeners; returns a detach function. */
export function attachKeyboard(onAction: (a: Action) => void): () => void {
  const down = (e: KeyboardEvent) => {
    if (isTypingTarget(e.target)) return;
    // Let Space/Enter activate focused buttons; everything else drives.
    if ((e.code === 'Space' || e.code === 'Enter') && isActivatable(e.target)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (DRIVE_CODES.has(e.code)) {
      if (controls.enabled) {
        controls.keys.add(e.code);
        e.preventDefault();
      }
      return;
    }
    const action = ACTION_CODES[e.code];
    if (action && !e.repeat) {
      if (action === 'roll180') controls.rollRequest = true;
      onAction(action);
    }
  };
  const up = (e: KeyboardEvent) => {
    controls.keys.delete(e.code);
  };
  const blur = () => controls.keys.clear();
  // After a mouse/touch click on a button, slider or checkbox, give the keyboard back to the game
  // (otherwise Space would re-press the button and WASD would move the slider). Keyboard-driven
  // activation keeps focus, so keyboard-only users are unaffected.
  const release = (e: Event) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const pointer = e.type === 'pointerup' || (e as MouseEvent).detail > 0;
    const el = t.closest('button, input[type="range"], input[type="checkbox"]');
    if (pointer && el instanceof HTMLElement && !el.closest('[role="dialog"]')) {
      setTimeout(() => el.blur(), 0);
    }
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  window.addEventListener('click', release, true);
  window.addEventListener('pointerup', release, true);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', blur);
    window.removeEventListener('click', release, true);
    window.removeEventListener('pointerup', release, true);
  };
}

const dead = (v: number, d = 0.12) => (Math.abs(v) < d ? 0 : (v - Math.sign(v) * d) / (1 - d));

/** Poll the first connected gamepad (standard mapping). */
function readGamepad(onAction: (a: Action) => void): Partial<DriveInput> & { any: boolean } {
  const pads = ((): (Gamepad | null)[] => {
    try {
      return navigator.getGamepads?.() ? Array.from(navigator.getGamepads()) : [];
    } catch {
      return [];
    }
  })();
  const gp = pads.find((p): p is Gamepad => !!p && p.connected);
  if (!gp) return { any: false };
  const b = (i: number) => gp.buttons[i]?.pressed ?? false;
  const v = (i: number) => gp.buttons[i]?.value ?? 0;
  const edges: [number, Action][] = [
    [3, 'roll180'],
    [2, 'xray'],
    [1, 'fans'],
    [9, 'pause'],
    [8, 'camera'],
  ];
  for (const [i, action] of edges) {
    if (b(i) && !controls.lastGamepadButtons[i]) {
      if (action === 'roll180') controls.rollRequest = true;
      onAction(action);
    }
  }
  controls.lastGamepadButtons = gp.buttons.map((x) => x.pressed);
  const lx = dead(gp.axes[0] ?? 0);
  const ly = dead(gp.axes[1] ?? 0);
  const rx = dead(gp.axes[2] ?? 0);
  return {
    any: true,
    steer: -lx,
    pitch: -ly,
    roll: lx,
    yaw: -rx,
    throttle: v(7),
    brake: v(6),
    thrust: b(0) ? 1 : 0,
    lift: Math.max(v(5), b(4) ? 1 : 0),
  };
}

/** Merge all input sources into a DriveInput. `airborne` switches WASD to attitude control. */
export function readDriveInput(airborne: boolean, onAction: (a: Action) => void): DriveInput {
  if (!controls.enabled) return { ...NO_INPUT };
  const k = controls.keys;
  const has = (...codes: string[]) => codes.some((c) => k.has(c));
  const up = has('KeyW', 'ArrowUp') ? 1 : 0;
  const downKey = has('KeyS', 'ArrowDown') ? 1 : 0;
  const left = has('KeyA', 'ArrowLeft') ? 1 : 0;
  const right = has('KeyD', 'ArrowRight') ? 1 : 0;

  const input: DriveInput = {
    throttle: up,
    brake: downKey,
    steer: left - right,
    thrust: has('Space') ? 1 : 0,
    lift: has('ShiftLeft', 'ShiftRight') ? 1 : 0,
    pitch: airborne ? up - downKey : 0,
    roll: airborne ? right - left : 0,
    yaw: (has('KeyQ') ? 1 : 0) - (has('KeyE') ? 1 : 0),
    roll180: controls.rollRequest,
  };
  controls.rollRequest = false;

  const t = controls.touch;
  if (t.active) {
    input.steer = clamp1(input.steer - t.stickX);
    input.throttle = Math.max(input.throttle, Math.max(0, -t.stickY));
    input.brake = Math.max(input.brake, Math.max(0, t.stickY), t.brake ? 1 : 0);
    if (airborne) {
      input.roll = clamp1(input.roll + t.stickX);
      input.pitch = clamp1(input.pitch - t.stickY);
    }
    if (t.thrust) input.thrust = 1;
    if (t.lift) input.lift = 1;
  }

  const gp = readGamepad(onAction);
  if (gp.any) {
    input.steer = clamp1(input.steer + (gp.steer ?? 0));
    input.throttle = Math.max(input.throttle, gp.throttle ?? 0);
    input.brake = Math.max(input.brake, gp.brake ?? 0);
    input.thrust = Math.max(input.thrust, gp.thrust ?? 0);
    input.lift = Math.max(input.lift, gp.lift ?? 0);
    input.yaw = clamp1(input.yaw + (gp.yaw ?? 0));
    if (airborne) {
      input.pitch = clamp1(input.pitch + (gp.pitch ?? 0));
      input.roll = clamp1(input.roll + (gp.roll ?? 0));
    }
  }
  return input;
}

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));
