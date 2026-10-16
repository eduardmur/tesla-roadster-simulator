/** Full-screen cinematic hero: title, hook, three entry points, loader with real progress. */
import { HOW_IT_WORKS } from '../app/links';
import { useApp } from '../state/store';
import { SpecValue } from './SpecValue';
import { enterMode } from '../app/modes';

export function Landing() {
  const load = useApp((s) => s.load);
  const ready = load.stage === 'ready';
  return (
    <section className="landing" aria-labelledby="hero-title">
      <div className="landing__inner">
        <div className="eyebrow">Explainer · facts as of 16 Oct 2026</div>
        <h1 id="hero-title">
          Flying <span className="accent">Tesla</span>
        </h1>
        <p className="landing__hook">
          How a roadster can stick to a ceiling with fans, then hop and flip on nothing but
          compressed air. Feel the physics, with honest numbers.
        </p>
        <ul className="landing__facts" aria-label="Key numbers">
          <li>
            Downforce readout: <SpecValue id="invertedDownforce" />
          </li>
          <li>
            Rear thrust: <SpecValue id="rearThrustTotal" />
          </li>
          <li>
            Air on board: <SpecValue id="airMass" />
          </li>
        </ul>
        {!ready && (
          <div
            className="loader"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(load.progress * 100)}
            aria-label="Loading"
          >
            <div className="loader__bar">
              <div
                className="loader__fill"
                style={{ width: `${Math.round(load.progress * 100)}%` }}
              />
            </div>
            <div className="loader__label">
              {load.stage === 'error'
                ? `${load.label}. You can still read how it works.`
                : `${load.label || 'Starting…'} ${Math.round(load.progress * 100)}%`}
            </div>
          </div>
        )}
        <div className="landing__actions">
          <button
            type="button"
            className="btn btn--primary"
            disabled={!ready}
            onClick={() => enterMode('tour')}
          >
            Take the tour
          </button>
          <button
            type="button"
            className="btn"
            disabled={!ready}
            onClick={() => enterMode('drive')}
          >
            Drive it
          </button>
          <button
            type="button"
            className="btn btn--cool"
            disabled={!ready}
            onClick={() => enterMode('drive', { inside: true })}
          >
            Look inside
          </button>
          <a className="btn btn--ghost" href={HOW_IT_WORKS}>
            Read it instead (no 3D)
          </a>
        </div>
        <p className="landing__fine">
          <strong>Unofficial educational simulation. Not affiliated with Tesla or SpaceX.</strong>{' '}
          “Tesla” and “Roadster” are trademarks of Tesla, Inc., used here only to identify the
          subject. Figures come from public reporting as of 16 Oct 2026; estimates are marked{' '}
          <span className="tag tag--estimate">est.</span>
        </p>
      </div>
    </section>
  );
}
