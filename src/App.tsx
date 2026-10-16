/** App shell: landing, drive, tour; the 3D scene and heavy panels are code-split. */
import { lazy, Suspense, useEffect, useState } from 'react';
import { host } from './app/host';
import { announce } from './app/captions';
import { director } from './scene/cameras/director';
import { useApp } from './state/store';
import { ChallengeOverlay } from './ui/challenges/ChallengeUI';
import { Dock } from './ui/challenges/Dock';
import { ControlsHelp, TouchControls } from './ui/controls/ControlsUI';
import { isTouchDevice, useFirstPlayControls } from './ui/controls/firstPlay';
import { attachKeyboard } from './ui/controls/input';
import { onAction } from './app/actions';
import { Hud } from './ui/hud/Hud';
import { Settings } from './ui/Settings';
import { TopBar } from './ui/TopBar';
import { Landing } from './ui/Landing';
import { HOW_IT_WORKS } from './app/links';

const Experience = lazy(() => import('./scene/Experience'));
const Lab = lazy(() => import('./ui/lab/Lab'));
const SpecsModal = lazy(() => import('./ui/lab/SpecsModal'));
const Tour = lazy(() => import('./ui/tour/Tour'));
const AudioBridge = lazy(() => import('./audio/AudioBridge'));

function hasWebGL2(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

function NoWebGL() {
  return (
    <main className="nowebgl">
      <h1>Flying Tesla</h1>
      <p className="muted">
        Unofficial educational simulation. Not affiliated with Tesla or SpaceX.
      </p>
      <p>
        Your browser can’t run the 3D simulation: WebGL 2 isn’t available. You can still read the
        full explanation, with diagrams and every sourced number.
      </p>
      <p>
        <a className="btn btn--primary" href={HOW_IT_WORKS}>
          Read how it works
        </a>
      </p>
    </main>
  );
}

function DriveUI() {
  const labOpen = useApp((s) => s.labOpen);
  const [showHelp, closeHelp] = useFirstPlayControls(true);
  const [touch] = useState(isTouchDevice);
  return (
    <>
      <Dock />
      <Hud />
      <ChallengeOverlay />
      {labOpen && (
        <Suspense fallback={null}>
          <Lab />
        </Suspense>
      )}
      {touch && <TouchControls />}
      {showHelp && <ControlsHelp onClose={closeHelp} />}
      <div className="rotate-hint is-driving" role="note">
        <p>Turn your phone sideways for the best view.</p>
      </div>
    </>
  );
}

function Captions() {
  const caption = useApp((s) => s.caption);
  return (
    <div className="sr-only" aria-live="polite" role="status">
      {caption}
    </div>
  );
}

function VisibleCaption() {
  const caption = useApp((s) => s.caption);
  const hideUi = useApp((s) => s.hideUi);
  if (!caption || hideUi) return null;
  return (
    <div className="panel caption" aria-hidden="true">
      {caption}
    </div>
  );
}

export function App() {
  const [webgl] = useState(hasWebGL2);
  const mode = useApp((s) => s.mode);
  const specsOpen = useApp((s) => s.specsOpen);
  const settingsOpen = useApp((s) => s.settingsOpen);
  const set = useApp((s) => s.set);
  const hideUi = useApp((s) => s.hideUi);

  useEffect(() => attachKeyboard(onAction), []);

  // Start loading the 3D scene immediately, then the physics WASM once the first frame is up.
  useEffect(() => {
    if (!webgl) return;
    set({ load: { stage: 'scene', progress: 0.15, label: 'Loading the 3D scene…' } });
    const onFirst = () => {
      host
        .load((p, label) =>
          set({ load: { stage: p >= 1 ? 'ready' : 'physics', progress: 0.45 + 0.55 * p, label } }),
        )
        .catch((e: unknown) =>
          set({
            load: {
              stage: 'error',
              progress: 0,
              label: 'Physics failed to load',
              error: String(e),
            },
          }),
        );
    };
    window.addEventListener('flying-tesla:first-frame', onFirst, { once: true });
    return () => window.removeEventListener('flying-tesla:first-frame', onFirst);
  }, [webgl, set]);

  // Landing hero camera.
  useEffect(() => {
    director.shot =
      mode === 'landing'
        ? { kind: 'orbit', radius: 8.5, height: 1.5, speed: 0.07, fov: 38 }
        : mode === 'drive'
          ? null
          : director.shot;
    director.cut = true;
    if (mode === 'drive') announce('Drive mode. Controls are in the top bar.', 2000);
  }, [mode]);

  if (!webgl) return <NoWebGL />;

  return (
    <>
      <Suspense fallback={null}>
        <Experience />
      </Suspense>
      {!hideUi && <TopBar />}
      {mode === 'landing' && <Landing />}
      {mode === 'drive' && !hideUi && <DriveUI />}
      {mode === 'tour' && (
        <Suspense fallback={null}>
          <Tour />
        </Suspense>
      )}
      {specsOpen && (
        <Suspense fallback={null}>
          <SpecsModal />
        </Suspense>
      )}
      {settingsOpen && <Settings />}
      <VisibleCaption />
      <Captions />
      <Suspense fallback={null}>
        <AudioBridge />
      </Suspense>
    </>
  );
}
