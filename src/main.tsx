import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { Global } from 'recharts';
import { routeTree } from './routeTree.gen';
// Self-hosted variable fonts — bundled and precached for offline use.
// Recursive: UI voice. Shantell Sans: hand-written voice for titles and hero amounts.
import '@fontsource-variable/recursive/wght.css';
import '@fontsource-variable/shantell-sans/wght.css';
import './index.css';

// Recharts v3 enables its internal Redux DevTools integration by default, which
// causes `n.match is not a function` in the Redux DevTools extension serializer
// for every chart that dispatches props. Disabling it fixes all chart crashes.
Global.devToolsEnabled = false;

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
