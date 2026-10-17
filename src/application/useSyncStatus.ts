/**
 * Sync status hooks — the only way features reach the sync model.
 *
 *   useSyncStatus()          → health + session activity log + timeline
 *   useSyncActions(view)     → retry, clear the log, diagnostics text
 *   useSyncActivityTracking()→ tracks while signed in (root layout)
 *
 * The types the UI needs are re-exported here so features never import
 * infrastructure.
 */

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useStatus } from '@powersync/react';
import {
  classifySyncError,
  reconnectSync,
  selectUnresolvedUploadFailure,
  startSyncActivityTracking,
  syncActivity,
  type SyncActivityEvent,
  type SyncConnectionTimeline,
} from '@/infrastructure/powersync/sync';
import { usePendingUploadCount } from '@/infrastructure/powersync/queries/useSyncQueries';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { deriveSyncHealth, type SyncHealth } from './sync/syncHealth';

export type {
  SyncActivityEvent,
  SyncChangeOp,
  SyncConnectionState,
  SyncConnectionTimeline,
  SyncErrorInfo,
  SyncErrorKind,
  SyncRecordChange,
  SyncUploadFailedEvent,
} from '@/infrastructure/powersync/sync';
export type { SyncAlert, SyncAlertKind, SyncAlertSeverity, SyncHealth, SyncHealthState } from './sync/syncHealth';

export interface SyncStatusView {
  health: SyncHealth;
  /** This session's activity, newest first. */
  events: SyncActivityEvent[];
  connection: SyncConnectionTimeline;
  /** Epoch ms of the last completed sync, or null. */
  lastSyncedAt: number | null;
  /** 0–1 while a download is in progress, otherwise null. */
  downloadFraction: number | null;
  sessionStartedAt: number;
}

export interface SyncActions {
  /** Restarts the sync stream now instead of waiting for the next retry. */
  retry: () => Promise<void>;
  clearLog: () => void;
  /** Pretty JSON of the current health, timeline and log, for support. */
  diagnosticsText: () => string;
}

// ---------------------------------------------------------------------------
// useSyncStatus
// ---------------------------------------------------------------------------

export function useSyncStatus(): SyncStatusView {
  const status = useStatus();
  const activity = useSyncExternalStore(syncActivity.subscribe, syncActivity.getSnapshot);
  const pendingCount = usePendingUploadCount();
  const online = useOnlineStatus();
  // Only the timeout below moves `now`: a stale value can delay an alert,
  // never show one early, and the timeout then catches it up.
  const [now, setNow] = useState(Date.now);

  const { uploadError, downloadError, uploading = false, downloading = false } = status.dataFlowStatus;
  const uploadFailure = selectUnresolvedUploadFailure(activity)?.error ?? null;
  // Errors from the sync worker keep only their message: a fallback signal.
  const uploadErrorInfo = useMemo(() => (uploadError ? classifySyncError(uploadError, online) : null), [uploadError, online]);
  const downloadErrorInfo = useMemo(
    () => (downloadError ? classifySyncError(downloadError, online) : null),
    [downloadError, online],
  );
  const { disconnectedSince, downloadErrorSince } = activity.connection;

  const health = useMemo(
    () =>
      deriveSyncHealth({
        connected: status.connected,
        connecting: status.connecting,
        uploading,
        downloading,
        hasUploadError: uploadError != null,
        hasDownloadError: downloadError != null,
        uploadFailure,
        uploadError: uploadErrorInfo,
        downloadError: downloadErrorInfo,
        pendingCount,
        online,
        disconnectedSince,
        downloadErrorSince,
        now,
      }),
    [
      status.connected,
      status.connecting,
      uploading,
      downloading,
      uploadError,
      downloadError,
      uploadFailure,
      uploadErrorInfo,
      downloadErrorInfo,
      pendingCount,
      online,
      disconnectedSince,
      downloadErrorSince,
      now,
    ],
  );

  // One timeout to the next moment the health may change on its own — no
  // permanent interval. Cleared when that moment moves and on unmount.
  const { nextCheckAt } = health;
  useEffect(() => {
    if (nextCheckAt === null) return;
    const timer = setTimeout(() => setNow(Math.max(Date.now(), nextCheckAt)), Math.max(0, nextCheckAt - Date.now()));
    return () => clearTimeout(timer);
  }, [nextCheckAt]);

  const lastSyncedAt = status.lastSyncedAt?.getTime() ?? activity.connection.lastSyncedAt;
  const downloadFraction = status.downloadProgress?.downloadedFraction ?? null;

  return useMemo(
    () => ({
      health,
      events: activity.events,
      connection: activity.connection,
      lastSyncedAt,
      downloadFraction,
      sessionStartedAt: activity.sessionStartedAt,
    }),
    [health, activity, lastSyncedAt, downloadFraction],
  );
}

// ---------------------------------------------------------------------------
// useSyncActions
// ---------------------------------------------------------------------------

/**
 * Sync actions for the status the caller already reads: pass the result of
 * your useSyncStatus() call, so one subscription set serves both hooks.
 */
export function useSyncActions(view: Pick<SyncStatusView, 'health' | 'connection' | 'events'>): SyncActions {
  const { health, connection, events } = view;

  const retry = useCallback(() => reconnectSync(), []);
  const clearLog = useCallback(() => syncActivity.clear(), []);
  const diagnosticsText = useCallback(
    () =>
      JSON.stringify(
        { generatedAt: new Date().toISOString(), userAgent: navigator.userAgent, health, connection, events },
        null,
        2,
      ),
    [health, connection, events],
  );

  return useMemo(() => ({ retry, clearLog, diagnosticsText }), [retry, clearLog, diagnosticsText]);
}

// ---------------------------------------------------------------------------
// useSyncActivityTracking
// ---------------------------------------------------------------------------

/**
 * Tracks sync activity while someone is signed in — call from the root with
 * the session's user id. Signing out or switching users stops tracking and
 * clears the session log, so nothing of one person reaches the next.
 */
export function useSyncActivityTracking(userId: string | null): void {
  useEffect(() => {
    if (userId === null) return;
    return startSyncActivityTracking();
  }, [userId]);
}
