/** Settings: quality preset (auto/manual), reduced motion, sound. */
import { resolvedQuality, useApp, type QualitySetting } from '../state/store';

export function Settings() {
  const quality = useApp((s) => s.quality);
  const resolved = useApp((s) => resolvedQuality(s));
  const reducedMotion = useApp((s) => s.reducedMotion);
  const muted = useApp((s) => s.muted);
  const set = useApp((s) => s.set);
  const close = () => set({ settingsOpen: false });
  const options: QualitySetting[] = ['auto', 'low', 'medium', 'high'];
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="set-h"
      onClick={close}
    >
      <div className="panel modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2 id="set-h">Settings</h2>
          <button type="button" className="btn btn--small btn--ghost" onClick={close} autoFocus>
            Close
          </button>
        </header>
        <div className="eyebrow">Graphics quality</div>
        <div className="segmented" role="group" aria-label="Graphics quality">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              aria-pressed={quality === o}
              onClick={() => set({ quality: o })}
            >
              {o}
            </button>
          ))}
        </div>
        <p className="muted" style={{ fontSize: '0.875rem' }}>
          Now rendering at <strong>{resolved}</strong>. Auto lowers the quality if the frame rate
          drops.
        </p>
        <label className="toggle">
          <span>Reduce motion (no camera shake, gentler cameras)</span>
          <input
            type="checkbox"
            checked={reducedMotion}
            onChange={(e) => set({ reducedMotion: e.target.checked })}
          />
        </label>
        <label className="toggle">
          <span>Mute sound</span>
          <input
            type="checkbox"
            checked={muted}
            onChange={(e) => set({ muted: e.target.checked })}
          />
        </label>
        <p className="muted" style={{ fontSize: '0.875rem' }}>
          No analytics, no trackers. Best times are kept only in this browser.
        </p>
        <p className="footer-note">
          Unofficial educational project. Not affiliated with, endorsed by, or connected to Tesla,
          Inc. or SpaceX. “Tesla” and “Roadster” are trademarks of Tesla, Inc., used here only to
          identify the subject. Figures come from public reporting as of 16 Oct 2026; estimates are
          marked. Code MIT, text CC BY 4.0 ·{' '}
          <a
            href="https://github.com/eduardmur/flying-tesla"
            target="_blank"
            rel="noopener noreferrer"
          >
            Source on GitHub
          </a>
        </p>
      </div>
    </div>
  );
}
