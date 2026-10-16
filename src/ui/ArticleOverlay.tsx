/** "How it works" as a full-screen reading view over the simulator. */
import { useEffect, useMemo, useRef } from 'react';
import { articleHtml } from '../article/article';
import '../article/article.css';
import { useApp } from '../state/store';

export default function ArticleOverlay() {
  const set = useApp((s) => s.set);
  const html = useMemo(() => articleHtml(), []);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') set({ articleOpen: false });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [set]);
  return (
    <div className="reader" role="dialog" aria-modal="true" aria-label="How it works">
      <button
        ref={close}
        type="button"
        className="reader-close"
        onClick={() => set({ articleOpen: false })}
      >
        Close
      </button>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
