/** App shell: the 3D scene (code-split), the minimal overlay and the "How it works" reader. */
import { lazy, Suspense, useEffect, useState } from 'react';
import { host } from './app/host';
import { attachKeyboard } from './app/input';
import { useApp } from './state/store';
import { Overlay } from './ui/Overlay';

const Experience = lazy(() => import('./scene/Experience'));
const ArticleOverlay = lazy(() => import('./ui/ArticleOverlay'));
const AudioBridge = lazy(() => import('./audio/AudioBridge'));

const ARTICLE_URL = `${import.meta.env.BASE_URL}how-it-works/`;

function hasWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

function NoWebGL() {
  return (
    <main className="nowebgl">
      <h1>Tesla Roadster Simulator</h1>
      <p className="muted">Unofficial fan project. Not affiliated with Tesla.</p>
      <p>
        Your browser can’t run the 3D simulator because WebGL 2 isn’t available. You can still read
        how it works.
      </p>
      <p>
        <a className="primary" href={ARTICLE_URL}>
          How it works
        </a>
      </p>
    </main>
  );
}

export function App() {
  const [webgl] = useState(hasWebGL2);
  const articleOpen = useApp((s) => s.articleOpen);
  const set = useApp((s) => s.set);

  useEffect(() => attachKeyboard(host.onAction, () => !useApp.getState().articleOpen), []);

  useEffect(() => {
    if (!webgl) return;
    set({ load: { stage: 'scene', progress: 0.2, label: 'Loading' } });
    const onFirst = () => {
      host
        .load((p, label) =>
          set({ load: { stage: p >= 1 ? 'ready' : 'physics', progress: 0.4 + 0.6 * p, label } }),
        )
        .catch(() => set({ load: { stage: 'error', progress: 0, label: 'Error' } }));
    };
    window.addEventListener('trs:first-frame', onFirst, { once: true });
    return () => window.removeEventListener('trs:first-frame', onFirst);
  }, [webgl, set]);

  if (!webgl) return <NoWebGL />;
  return (
    <>
      <Suspense fallback={null}>
        <Experience />
      </Suspense>
      <Overlay />
      {articleOpen && (
        <Suspense fallback={null}>
          <ArticleOverlay />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <AudioBridge />
      </Suspense>
    </>
  );
}
