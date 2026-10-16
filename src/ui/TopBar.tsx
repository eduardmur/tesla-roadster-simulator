/** Brand (with the unofficial line next to the name), mode navigation, mute. */
import { useState } from 'react';
import { HOW_IT_WORKS } from '../app/links';
import { useApp } from '../state/store';
import { enterMode } from '../app/modes';
import { ControlsHelp } from './controls/ControlsUI';
import { CAMERA_LABELS } from '../state/store';

function MuteButton() {
  const muted = useApp((s) => s.muted);
  const toggle = useApp((s) => s.toggle);
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={() => toggle('muted')}
      aria-pressed={muted}
      aria-label={muted ? 'Unmute sound' : 'Mute sound'}
      title={muted ? 'Unmute' : 'Mute'}
    >
      {muted ? (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M3 8h3l4-3v10l-4-3H3z" fill="currentColor" />
          <path d="M13 7l5 6M18 7l-5 6" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M3 8h3l4-3v10l-4-3H3z" fill="currentColor" />
          <path
            d="M13 7c1.5 1.6 1.5 4.4 0 6M15.5 5c2.6 2.8 2.6 7.2 0 10"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
          />
        </svg>
      )}
    </button>
  );
}

export function TopBar() {
  const mode = useApp((s) => s.mode);
  const set = useApp((s) => s.set);
  const camera = useApp((s) => s.camera);
  const cycleCamera = useApp((s) => s.cycleCamera);
  const xray = useApp((s) => s.xray);
  const toggle = useApp((s) => s.toggle);
  const [help, setHelp] = useState(false);
  const [menu, setMenu] = useState(false);
  return (
    <header className="topbar">
      <div className="brand">
        <button
          type="button"
          className="brand__name"
          onClick={() => enterMode('landing')}
          aria-label="Flying Tesla — back to start"
        >
          Flying Tesla
        </button>
        <span className="brand__unofficial">
          Unofficial educational simulation. Not affiliated with Tesla or SpaceX.
        </span>
      </div>
      <nav className="topbar__nav" aria-label="Main">
        {mode !== 'landing' && (
          <>
            <button
              type="button"
              className="btn btn--small hide-sm"
              onClick={() => enterMode('tour')}
              aria-pressed={mode === 'tour'}
            >
              Tour
            </button>
            <button
              type="button"
              className="btn btn--small hide-sm"
              onClick={() => enterMode('drive')}
              aria-pressed={mode === 'drive' && !xray}
            >
              Drive
            </button>
            <button
              type="button"
              className="btn btn--small"
              onClick={() =>
                mode === 'drive' ? toggle('xray') : enterMode('drive', { inside: true })
              }
              aria-pressed={xray}
              title="X-ray (X)"
            >
              Look inside
            </button>
          </>
        )}
        <div className="more">
          <button
            type="button"
            className="btn btn--small"
            aria-expanded={menu}
            aria-haspopup="true"
            onClick={() => setMenu(!menu)}
          >
            More
          </button>
          {menu && (
            <div className="panel more__menu" role="menu" onClick={() => setMenu(false)}>
              {mode === 'drive' && (
                <>
                  <button type="button" role="menuitem" onClick={() => toggle('labOpen')}>
                    Lab panels <kbd>L</kbd>
                  </button>
                  <button type="button" role="menuitem" onClick={cycleCamera}>
                    Camera: {CAMERA_LABELS[camera]} <kbd>C</kbd>
                  </button>
                  <button type="button" role="menuitem" onClick={() => setHelp(true)}>
                    Controls
                  </button>
                </>
              )}
              <button type="button" role="menuitem" onClick={() => set({ specsOpen: true })}>
                What’s confirmed vs estimated
              </button>
              <a role="menuitem" href={HOW_IT_WORKS}>
                How it works (text version)
              </a>
              <button type="button" role="menuitem" onClick={() => set({ settingsOpen: true })}>
                Settings
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          className="btn btn--small hide-md"
          onClick={() => set({ specsOpen: true })}
        >
          Confirmed vs estimated
        </button>
        <MuteButton />
      </nav>
      {help && <ControlsHelp onClose={() => setHelp(false)} />}
    </header>
  );
}
