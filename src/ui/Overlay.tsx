/** Minimal interface: name, "How it works", mute, speed and three quiet readouts, one button. */
import { useEffect, useState } from 'react';
import { host } from '../app/host';
import { useApp } from '../state/store';
import type { JumpStage } from '../sim/jump';

const STAGE_TEXT: Partial<Record<JumpStage, string>> = {
  approach: 'Approach',
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

export function Overlay() {
  const load = useApp((s) => s.load);
  const mode = useApp((s) => s.mode);
  const stage = useApp((s) => s.stage);
  const result = useApp((s) => s.result);
  const muted = useApp((s) => s.muted);
  const set = useApp((s) => s.set);
  const r = useReadout();
  const ready = load.stage === 'ready';
  const running = mode === 'auto' || mode === 'manual';

  return (
    <div className="ui">
      <header className="ui-top">
        <div className="brand">
          <div className="brand-name">Tesla Roadster Simulator</div>
          <div className="brand-note">Unofficial fan project. Not affiliated with Tesla.</div>
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
          {ready && running && (
            <div className="stage" role="status">
              {STAGE_TEXT[stage] ?? (mode === 'manual' ? 'Hold W to drive up' : 'Approach')}
            </div>
          )}
          {ready && mode === 'done' && result && (
            <div className="result" role="status">
              <div className="result-title">{result.headline}</div>
              {result.success && (
                <div className="result-line">
                  {Math.round(result.maxHeight)} m high · {result.peakG.toFixed(1)} g on landing ·{' '}
                  {Math.round(result.airUsed)} kg of air
                </div>
              )}
            </div>
          )}
          {ready && !running && (
            <>
              <button type="button" className="primary" onClick={() => host.launch()}>
                {mode === 'done' ? 'Again' : 'Launch'}
              </button>
              <div className="hint">Space to launch · or hold W to drive it yourself</div>
            </>
          )}
          {ready && running && (
            <button type="button" className="secondary" onClick={() => host.reset()}>
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
