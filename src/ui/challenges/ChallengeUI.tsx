/** Challenge status overlay, countdown banner and the result card. */
import { useEffect, useState } from 'react';
import { host } from '../../app/host';
import { SPECS, type Spec } from '../../data/specs';
import type { ChallengeHud, Medal } from '../../sim/challenges';
import { useApp } from '../../state/store';
import { curlSpeeds } from '../../sim/autopilot';
import { CURLS } from '../../sim/track';
import { fmt } from '../format';
import { useHost } from '../hooks';
import { StatusTag } from '../SpecValue';

function useChallengeHud(hz = 8): ChallengeHud | null {
  const [hud, setHud] = useState<ChallengeHud | null>(null);
  useEffect(() => {
    const id = setInterval(() => {
      const c = host.challenge;
      const sim = host.sim;
      setHud(c && sim && c.kind !== 'free' && c.phase !== 'done' ? c.hud(sim) : null);
    }, 1000 / hz);
    return () => clearInterval(id);
  }, [hz]);
  return hud;
}

export function ChallengeOverlay() {
  useHost();
  const hud = useChallengeHud();
  const autopilot = host.autopilotActive;
  const rampAssist = useApp((s) => s.rampAssist);
  const kind = host.challenge?.kind;
  const isCurl = kind === 'curl' || kind === 'practice';
  return (
    <>
      {hud && (
        <div className="panel challenge-hud" role="status" aria-live="polite">
          <div className="eyebrow">{autopilot ? 'Autopilot demo' : hud.title}</div>
          <div className="status">{hud.status}</div>
          <ul>
            {hud.lines.map((l) => (
              <li key={l.slice(0, 18)}>{l}</li>
            ))}
          </ul>
          {isCurl && !autopilot && (
            <p className="muted" style={{ fontSize: '0.8rem', margin: '4px 0 0' }}>
              {rampAssist
                ? `Ramp speed assist on: holding W gives a safe ${fmt(curlSpeeds(CURLS[kind as 'curl']).entry * 3.6, 0)} km/h. Just steer.`
                : 'Ramp speed assist off: arrive too fast and v²/R bottoms out the suspension.'}
            </p>
          )}
          <div className="actions" style={{ justifyContent: 'center', marginTop: 8 }}>
            <button
              type="button"
              className="btn btn--small"
              onClick={() => host.restartChallenge()}
            >
              Restart <kbd>T</kbd>
            </button>
            <button
              type="button"
              className="btn btn--small btn--ghost"
              onClick={() => host.stopChallenge()}
            >
              Quit
            </button>
          </div>
        </div>
      )}
      {hud?.banner && (
        <div className="banner" aria-hidden="true">
          {hud.banner}
        </div>
      )}
      <ResultCard />
    </>
  );
}

const MEDAL_TEXT: Record<Exclude<Medal, null>, string> = {
  gold: '★ Gold',
  silver: '◆ Silver',
  bronze: '● Bronze',
};

function ResultCard() {
  useHost();
  const r = host.lastResult;
  const isCurl = r?.kind === 'curl' || r?.kind === 'practice';
  const wasDemo = host.autopilotActive;
  const set = useApp((s) => s.set);
  if (!r) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="result-h">
      <div className="panel modal">
        <header>
          <div>
            <div className="eyebrow">{wasDemo ? 'Autopilot demo' : 'Result'}</div>
            <h2 id="result-h">{r.headline}</h2>
          </div>
          {r.medal ? (
            <span className={`medal medal--${r.medal}`}>{MEDAL_TEXT[r.medal]}</span>
          ) : (
            <span className="medal">No medal</span>
          )}
        </header>
        <dl className="result-lines">
          {r.lines.map((l) => {
            const spec = l.specId ? (SPECS[l.specId] as Spec) : null;
            return (
              <div key={l.label} style={{ display: 'contents' }}>
                <dt>{l.label}</dt>
                <dd>
                  {l.value}{' '}
                  {spec ? (
                    <StatusTag status={spec.status} source={spec.source} />
                  ) : (
                    <span className="tag tag--sim">sim</span>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
        <div className="actions">
          {isCurl && wasDemo ? (
            <button
              type="button"
              className="btn btn--primary"
              autoFocus
              onClick={() => {
                host.stopAutopilot();
                host.startChallenge(r.kind);
              }}
            >
              Your turn (with ghost)
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              autoFocus
              onClick={() => host.restartChallenge()}
            >
              Try again <kbd>T</kbd>
            </button>
          )}
          <button
            type="button"
            className="btn"
            onClick={() => {
              set({ xray: true, labOpen: true, labTab: 'tanks' });
              host.lastResult = null;
              host.stopAutopilot();
            }}
          >
            See the telemetry
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => host.stopChallenge()}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
