/** First-play controls overlay and on-screen touch controls. */
import { useEffect, useRef } from 'react';
import { useApp } from '../../state/store';
import { controls } from './input';

export function ControlsHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ctl-h">
      <div className="panel modal controls-help">
        <header>
          <h2 id="ctl-h">Controls</h2>
          <button
            type="button"
            className="btn btn--small btn--ghost"
            onClick={onClose}
            aria-label="Close controls"
          >
            Close
          </button>
        </header>
        <dl>
          <dt>
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd> / arrows
          </dt>
          <dd>Drive. In the air: W/S pitch, A/D roll</dd>
          <dt>
            <kbd>Space</kbd>
          </dt>
          <dd>Rear thrusters</dd>
          <dt>
            <kbd>Shift</kbd>
          </dt>
          <dd>Lift (Rocket)</dd>
          <dt>
            <kbd>Q</kbd> <kbd>E</kbd>
          </dt>
          <dd>Yaw nozzles (Rocket)</dd>
          <dt>
            <kbd>R</kbd>
          </dt>
          <dd>Roll 180° assist</dd>
          <dt>
            <kbd>F</kbd>
          </dt>
          <dd>Fans on/off</dd>
          <dt>
            <kbd>X</kbd>
          </dt>
          <dd>X-ray</dd>
          <dt>
            <kbd>L</kbd>
          </dt>
          <dd>Lab panels</dd>
          <dt>
            <kbd>P</kbd>
          </dt>
          <dd>Pause</dd>
          <dt>
            <kbd>C</kbd>
          </dt>
          <dd>Camera</dd>
          <dt>
            <kbd>T</kbd>
          </dt>
          <dd>Restart challenge</dd>
          <dt>
            <kbd>H</kbd>
          </dt>
          <dd>Hide the interface (screenshots)</dd>
        </dl>
        <p className="muted">
          Gamepad: triggers drive, A thrust, RB lift, Y roll, X X-ray. Touch: left stick, right
          buttons.
        </p>
        <button type="button" className="btn btn--primary" autoFocus onClick={onClose}>
          Let’s go
        </button>
      </div>
    </div>
  );
}

export function TouchControls() {
  const trim = useApp((s) => s.trim);
  const stick = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);

  useEffect(() => {
    controls.touch.active = true;
    return () => {
      controls.touch.active = false;
    };
  }, []);

  const move = (e: React.PointerEvent) => {
    const el = stick.current;
    if (!el || pointer.current !== e.pointerId) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(x, y);
    const k = l > 1 ? 1 / l : 1;
    controls.touch.stickX = x * k;
    controls.touch.stickY = y * k;
    if (knob.current) knob.current.style.transform = `translate(${x * k * 42}px, ${y * k * 42}px)`;
  };
  const end = () => {
    pointer.current = null;
    controls.touch.stickX = 0;
    controls.touch.stickY = 0;
    if (knob.current) knob.current.style.transform = '';
  };
  const hold = (key: 'thrust' | 'lift' | 'brake') => ({
    onPointerDown: (e: React.PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      controls.touch[key] = true;
    },
    onPointerUp: () => (controls.touch[key] = false),
    onPointerCancel: () => (controls.touch[key] = false),
    onPointerLeave: () => (controls.touch[key] = false),
  });

  return (
    <div className="touch">
      <div
        ref={stick}
        className="touch__stick"
        role="application"
        aria-label="Steering and throttle stick"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          pointer.current = e.pointerId;
          move(e);
        }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div ref={knob} className="touch__knob" />
      </div>
      <div className="touch__buttons">
        {trim !== 'performance' && (
          <button
            type="button"
            className="thrust"
            aria-label="Rear thrust (hold)"
            {...hold('thrust')}
          >
            THRUST
          </button>
        )}
        {trim === 'rocket' && (
          <button type="button" className="lift" aria-label="Lift (hold)" {...hold('lift')}>
            LIFT
          </button>
        )}
        <button type="button" aria-label="Brake (hold)" {...hold('brake')}>
          BRAKE
        </button>
        {trim === 'rocket' && (
          <button
            type="button"
            aria-label="Roll 180 degrees"
            onClick={() => (controls.rollRequest = true)}
          >
            ROLL
          </button>
        )}
      </div>
    </div>
  );
}
