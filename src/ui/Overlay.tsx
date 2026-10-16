/**
 * Minimal interface: the name (with the fine print behind a "?"), "How it works", mute, speed
 * and three quiet readouts, and touch pedals on phones and tablets.
 */
import { useEffect, useRef, useState } from 'react';
import { host } from '../app/host';
import { touch } from '../app/input';
import { useApp } from '../state/store';
import type { JumpStage } from '../sim/jump';

const REPO_URL = 'https://github.com/eduardmur/tesla-roadster-simulator';

const STAGE_TEXT: Partial<Record<JumpStage, string>> = {
  climb: 'Climbing the curl',
  inverted: 'Upside down',
  flight: 'Roll and land',
};

interface Readout {
  kmh: number;
  downforce: number;
  thrust: number;
  air: number;
}

function useReadout(): Readout | null {
  const [r, setR] = useState<Readout | null>(null);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 100) return;
      last = now;
      const t = host.sim?.telemetry;
      if (t) {
        setR({
          kmh: Math.round(t.speed * 3.6),
          downforce: Math.round(t.downforce / 1000),
          thrust: Math.round((t.rearThrust + t.liftThrust + t.yawThrust) / 1000),
          air: Math.round(t.tankMass),
        });
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return r;
}

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <path d="M3 8h3l4-3v10l-4-3H3z" fill="currentColor" />
      {muted ? (
        <path d="M13 7.5l4.5 5M17.5 7.5l-4.5 5" stroke="currentColor" strokeWidth="1.5" />
      ) : (
        <path
          d="M13 7c1.5 1.6 1.5 4.4 0 6M15.5 5c2.6 2.8 2.6 7.2 0 10"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
      )}
    </svg>
  );
}

/** "?" next to the name: the unofficial notice and a link to the source, one tap away. */
function About() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div className="about" ref={ref}>
      <button
        type="button"
        className="icon-btn about-btn"
        aria-label="About this project"
        aria-expanded={open}
        aria-controls="about-panel"
        onClick={() => setOpen(!open)}
      >
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
          <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M7.6 7.7a2.45 2.45 0 0 1 4.8.6c0 1.6-2.4 2-2.4 3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="10" cy="14.4" r="1" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div className="about-panel" id="about-panel" role="dialog" aria-label="About this project">
          <p>
            Unofficial fan project. Not affiliated with, endorsed by or connected to Tesla, Inc. or
            SpaceX. “Tesla” and “Roadster” are trademarks of Tesla, Inc. The 3D car is our own
            model, without logos.
          </p>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            Source code
          </a>
        </div>
      )}
    </div>
  );
}

type TouchKey = keyof typeof touch;

/** A hold-to-press on-screen control that writes into the shared touch state. */
function Hold({
  k,
  label,
  className,
  children,
}: {
  k: TouchKey;
  label: string;
  className: string;
  children: React.ReactNode;
}) {
  const release = () => {
    touch[k] = 0;
  };
  // Never leave a pedal stuck down if the control unmounts mid-press.
  useEffect(
    () => () => {
      touch[k] = 0;
    },
    [k],
  );
  return (
    <button
      type="button"
      className={`touch-btn ${className}`}
      aria-label={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        touch[k] = 1;
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

const chevron = (d: string) => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <path
      d={d}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const pedal = (w: number, h: number) => (
  <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
    <rect
      x="1"
      y="1"
      width={w - 2}
      height={h - 2}
      rx="5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    {Array.from({ length: Math.floor((h - 12) / 7) }, (_, i) => (
      <line
        key={i}
        x1="6"
        x2={w - 6}
        y1={9 + i * 7}
        y2={9 + i * 7}
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.6"
      />
    ))}
  </svg>
);

export function Overlay() {
  const load = useApp((s) => s.load);
  const mode = useApp((s) => s.mode);
  const stage = useApp((s) => s.stage);
  const result = useApp((s) => s.result);
  const muted = useApp((s) => s.muted);
  const set = useApp((s) => s.set);
  const r = useReadout();
  const ready = load.stage === 'ready';

  return (
    <div className="ui">
      <header className="ui-top">
        <div className="brand">
          <div className="brand-name">Tesla Roadster Simulator</div>
          <About />
        </div>
        <div className="top-actions">
          <button type="button" className="link-btn" onClick={() => set({ articleOpen: true })}>
            How it works
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => set({ muted: !muted })}
            aria-label={muted ? 'Unmute' : 'Mute'}
            aria-pressed={muted}
          >
            <SoundIcon muted={muted} />
          </button>
        </div>
      </header>

      <div className="ui-bottom">
        <div className="readout" aria-live="off">
          <div className="speed">
            <span className="speed-value">{r?.kmh ?? 0}</span>
            <span className="speed-unit">km/h</span>
          </div>
          <dl className="stats">
            <div>
              <dt>Suction</dt>
              <dd>{r?.downforce ?? 0} kN</dd>
            </div>
            <div>
              <dt>Thrust</dt>
              <dd>{r?.thrust ?? 0} kN</dd>
            </div>
            <div>
              <dt>Air</dt>
              <dd>{r?.air ?? 0} kg</dd>
            </div>
          </dl>
        </div>

        <div className="center">
          {!ready && (
            <div
              className="loading"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(load.progress * 100)}
              aria-label="Loading"
            >
              <div className="loading-bar">
                <div style={{ width: `${Math.round(load.progress * 100)}%` }} />
              </div>
              <span>
                {load.stage === 'error' ? 'Could not load the physics engine' : 'Loading'}
              </span>
            </div>
          )}
          {ready && mode === 'idle' && (
            <div className="hint" role="status">
              <span className="for-keys">Hold W to drive up the ramp</span>
              <span className="for-touch">Hold the pedal to drive up the ramp</span>
            </div>
          )}
          {ready && mode === 'manual' && STAGE_TEXT[stage] && (
            <div className="stage" role="status">
              {STAGE_TEXT[stage]}
            </div>
          )}
          {ready && mode === 'done' && result && (
            <>
              <div className="result" role="status">
                <div className="result-title">{result.headline}</div>
                {result.success && (
                  <div className="result-line">
                    {Math.round(result.maxHeight)} m high · {result.peakG.toFixed(1)} g on landing ·{' '}
                    {Math.round(result.airUsed)} kg of air
                  </div>
                )}
              </div>
              <button type="button" className="primary" onClick={() => host.reset()}>
                Again
              </button>
              <div className="hint">
                <span className="for-keys">Space to go again · W to keep driving</span>
                <span className="for-touch">or press the pedal to keep driving</span>
              </div>
            </>
          )}
          {ready && mode === 'manual' && (
            <button type="button" className="secondary" onClick={() => host.reset()}>
              Reset
            </button>
          )}
        </div>

        <div className="touch-steer">
          <Hold k="left" label="Steer left" className="steer">
            {chevron('M15 5l-7 7 7 7')}
          </Hold>
          <Hold k="right" label="Steer right" className="steer">
            {chevron('M9 5l7 7-7 7')}
          </Hold>
        </div>
        <div className="touch-pedals">
          <Hold k="brake" label="Brake and reverse" className="brake">
            {pedal(40, 30)}
          </Hold>
          <Hold k="throttle" label="Accelerate" className="throttle">
            {pedal(34, 62)}
          </Hold>
        </div>
      </div>
    </div>
  );
}
