/**
 * Sync status context — the app-wide sync state the header control reads.
 *
 * SyncStatusProvider fills it once at the root. This module holds only the
 * context and its types (type-only imports), so consumers and their tests
 * load no PowerSync code.
 */

import { createContext, useContext } from 'react';
import type { SyncStatusView } from '@/application/useSyncStatus';

export interface SyncStatusContextValue {
  /** The sync UI shows only to a signed-in person. */
  signedIn: boolean;
  status: SyncStatusView;
  /** When the current alert first appeared (epoch ms), or null without one. */
  alertSince: number | null;
  /** Restarts the sync stream now. */
  retry: () => Promise<void>;
  clearLog: () => void;
  /** Writes the diagnostics to the clipboard; rejects when it cannot. Never sent anywhere. */
  copyDiagnostics: () => Promise<void>;
  /** Signs out (keeping the local data and upload queue) and opens the login page. */
  signIn: () => Promise<void>;
}

export const SyncStatusContext = createContext<SyncStatusContextValue | null>(null);

/** The app-wide sync state, or null outside a SyncStatusProvider. */
export function useSyncStatusContext(): SyncStatusContextValue | null {
  return useContext(SyncStatusContext);
}
