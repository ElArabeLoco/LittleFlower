/**
 * SyncStatusProvider — reads the sync model once for the whole app.
 *
 * Mounted at the root, around the routed pages, so it outlives navigation.
 * Each page's header reads it from context instead of subscribing on mount,
 * which used to restart the upload-queue count at 0 for a moment and
 * re-announce alerts on every page change.
 *
 * It also remembers when the current alert first appeared, so a header that
 * mounts later can tell a fresh alert (announce it) from a known one (show
 * it quietly).
 */

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useSyncActions, useSyncStatus } from '@/application/useSyncStatus';
import { useAuth } from '@/features/auth/AuthContext';
import { NO_ALERT, trackAlert } from './syncPresentation';
import { SyncStatusContext, type SyncStatusContextValue } from './syncStatusContext';

export function SyncStatusProvider({ children }: { children: ReactNode }) {
  const status = useSyncStatus();
  // The actions read this same status: one set of sync subscriptions for the app.
  const { retry, clearLog, diagnosticsText } = useSyncActions(status);
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  // Adjusting state while rendering: when the alert changes, store when it
  // appeared before anything below reads it (no effect, no stale render).
  const [alertTracking, setAlertTracking] = useState(NO_ALERT);
  const nextTracking = trackAlert(alertTracking, status.health.alert, Date.now());
  if (nextTracking !== alertTracking) setAlertTracking(nextTracking);
  const alertSince = nextTracking.since;

  // Household data (labels, notes, amounts): the clipboard only, never the network.
  const copyDiagnostics = useCallback(async () => {
    await navigator.clipboard.writeText(diagnosticsText());
  }, [diagnosticsText]);

  // Logging out keeps the local database and its upload queue; the queue
  // uploads once the person signs in again.
  const signIn = useCallback(async () => {
    await logout();
    await navigate({ to: '/login' });
  }, [logout, navigate]);

  const signedIn = session !== null;
  const value = useMemo<SyncStatusContextValue>(
    () => ({ signedIn, status, alertSince, retry, clearLog, copyDiagnostics, signIn }),
    [signedIn, status, alertSince, retry, clearLog, copyDiagnostics, signIn],
  );

  return <SyncStatusContext.Provider value={value}>{children}</SyncStatusContext.Provider>;
}
