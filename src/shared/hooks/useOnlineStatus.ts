/**
 * useOnlineStatus — the browser's online state (navigator.onLine), kept
 * current through the window `online` / `offline` events.
 *
 * `false` is reliable (no network at all); `true` only means a network is
 * available, not that a server is reachable.
 */

import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

const getSnapshot = () => navigator.onLine;

/** Assume online when rendering without a browser. */
const getServerSnapshot = () => true;

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
