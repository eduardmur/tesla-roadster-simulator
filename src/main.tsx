import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { host } from './app/host';
import { useApp } from './state/store';
import { director } from './scene/cameras/director';

// Handle for the Playwright smoke tests (no tracking; just lets tests drive the app).
(window as unknown as { __ft: unknown }).__ft = { host, app: useApp, director };

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
