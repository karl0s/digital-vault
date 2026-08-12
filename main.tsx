import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

/**
 * The playground is a local authoring surface, not part of the deployed site.
 *
 * Vite substitutes a literal `false` for `import.meta.env.DEV` in a production
 * build, so Rollup proves this branch unreachable and drops it along with the
 * dynamic import — which is what keeps PlaygroundRouter's
 * `import.meta.glob('./_playground/**')` from pulling every experiment into
 * dist/. The import must stay dynamic and stay inside the condition: a
 * top-level `import { PlaygroundRouter } from './PlaygroundRouter'` is
 * unconditional and bundles the lot regardless of this check.
 *
 * In dev it behaves exactly as before — /playground and /playground/<slug>.
 */
if (import.meta.env.DEV && window.location.pathname.startsWith(`${base}/playground`)) {
  import('./PlaygroundRouter').then(({ PlaygroundRouter }) => {
    root.render(
      <React.StrictMode>
        <PlaygroundRouter />
      </React.StrictMode>,
    );
  });
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
