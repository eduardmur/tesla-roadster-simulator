/** Pause, slow motion (0.1×–1×) and the 10-second scrub-back timeline. */
import { useEffect, useState } from 'react';
import { host } from '../../app/host';
import { useApp } from '../../state/store';
import { fmt } from '../format';

export function TimeBar() {
  const paused = useApp((s) => s.paused);
  const timeScale = useApp((s) => s.timeScale);
  const scrub = useApp((s) => s.scrub);
  const set = useApp((s) => s.set);
  const [range, setRange] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setRange(host.scrubRange), 250);
    return () => clearInterval(id);
  }, []);

  const startOrMove = (v: number) => {
    set({ scrub: v, paused: true });
    host.scrubTo(v);
  };

  return (
    <div className="panel timebar" role="group" aria-label="Time controls">
      <button
        type="button"
        className="icon-btn"
        onClick={() => {
          if (scrub !== null) {
            host.cancelScrub();
            set({ scrub: null, paused: false });
          } else set({ paused: !paused });
        }}
        aria-label={paused ? 'Play (P)' : 'Pause (P)'}
        title={paused ? 'Play (P)' : 'Pause (P)'}
      >
        {paused ? (
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5 3l12 7-12 7z" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <rect x="4" y="3" width="4" height="14" fill="currentColor" />
            <rect x="12" y="3" width="4" height="14" fill="currentColor" />
          </svg>
        )}
      </button>
      <label className="sr-only" htmlFor="slowmo">
        Slow motion
      </label>
      <span className="mono" aria-hidden="true">
        {fmt(timeScale, 1)}×
      </span>
      <input
        id="slowmo"
        type="range"
        min={0.1}
        max={1}
        step={0.1}
        value={timeScale}
        onChange={(e) => set({ timeScale: Number(e.target.value) })}
        aria-valuetext={`${fmt(timeScale, 1)} times speed`}
      />
      <label className="sr-only" htmlFor="scrub">
        Scrub back up to 10 seconds
      </label>
      <span className="mono" aria-hidden="true">
        {scrub !== null ? `−${fmt(scrub, 1)} s` : 'live'}
      </span>
      <input
        id="scrub"
        type="range"
        min={0}
        max={Math.max(0.1, range)}
        step={0.05}
        value={scrub === null ? 0 : Math.max(0, range - scrub)}
        style={{ direction: 'ltr' }}
        disabled={range < 0.2}
        onChange={(e) => startOrMove(Math.max(0, range - Number(e.target.value)))}
        aria-valuetext={scrub !== null ? `${fmt(scrub, 1)} seconds back` : 'live'}
      />
      {scrub !== null && (
        <button
          type="button"
          className="btn btn--small"
          onClick={() => {
            host.commitScrub();
            set({ scrub: null, paused: false });
          }}
        >
          Resume here
        </button>
      )}
    </div>
  );
}
