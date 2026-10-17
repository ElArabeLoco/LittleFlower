/**
 * Connection tracker — the connection timeline and its log entries.
 *
 * Listens to PowerSync status changes and keeps the store's timeline current
 * (connectedAt, disconnectedSince, downloadErrorSince, lastSyncedAt), and
 * logs 'connection' events:
 *   - connected     — as soon as the stream connects;
 *   - disconnected  — only when the stream is still down after a grace period,
 *                     so reconnect blips never reach the log, and never before
 *                     the session's first connection;
 *   - error         — when a download/connection error appears or changes
 *                     kind / code (messages carry request ids, so they are
 *                     never compared).
 * The timeline itself always updates immediately.
 */

import { classifySyncError } from './syncErrors';
import type { SyncActivityStore } from './syncActivityStore';
import type { SyncConnectionTimeline } from './types';

/** The slice of PowerSync's SyncStatus the tracker reads. */
export interface ConnectionStatusLike {
  readonly connected: boolean;
  readonly connecting: boolean;
  readonly lastSyncedAt?: Date;
  readonly dataFlowStatus: { readonly downloadError?: Error };
}

/** The slice of the PowerSync database the tracker needs. */
export interface ConnectionTrackerDb {
  readonly currentStatus: ConnectionStatusLike;
  registerListener(listener: { statusChanged?: (status: ConnectionStatusLike) => void }): () => void;
}

export interface ConnectionTrackingOptions {
  db: ConnectionTrackerDb;
  store: Pick<SyncActivityStore, 'getSnapshot' | 'recordConnection' | 'updateConnection'>;
  now?: () => number;
  /** Browser online state for error classification (undefined when unknown). */
  isOnline?: () => boolean | undefined;
  disconnectGraceMs?: number;
}

/** How long the stream must stay down before a 'disconnected' entry is logged. */
export const DISCONNECT_GRACE_MS = 3_000;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Starts tracking the connection; returns a function that stops it. */
export function startConnectionTracking({
  db,
  store,
  now = Date.now,
  isOnline = browserOnline,
  disconnectGraceMs = DISCONNECT_GRACE_MS,
}: ConnectionTrackingOptions): () => void {
  /** Last seen `connected`; null until the first status. */
  let connected: boolean | null = null;
  /** Nothing can be lost before the session's first connection: no 'disconnected' entry until then. */
  let everConnected = false;
  /** kind|code of the download error currently shown; null when none. */
  let errorKey: string | null = null;
  let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function cancelDisconnectEntry(): void {
    if (disconnectTimer === null) return;
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }

  function handle(status: ConnectionStatusLike): void {
    const at = now();
    const patch: Partial<SyncConnectionTimeline> = {};

    if (status.connected !== connected) {
      connected = status.connected;
      cancelDisconnectEntry();
      if (connected) {
        everConnected = true;
        patch.connectedAt = at;
        patch.disconnectedSince = null;
        store.recordConnection('connected');
      } else {
        // The timeline also covers the very first status when the app starts
        // disconnected; the log only reports losing a connection it had.
        patch.connectedAt = null;
        patch.disconnectedSince = at;
        if (everConnected) {
          disconnectTimer = setTimeout(() => {
            disconnectTimer = null;
            if (connected === false) store.recordConnection('disconnected');
          }, disconnectGraceMs);
        }
      }
    }

    const downloadError = status.dataFlowStatus?.downloadError;
    if (downloadError) {
      if (store.getSnapshot().connection.downloadErrorSince === null) patch.downloadErrorSince = at;
      const info = classifySyncError(downloadError, isOnline());
      const key = `${info.kind}|${info.code ?? ''}`;
      if (key !== errorKey) {
        errorKey = key;
        store.recordConnection('error', info);
      }
    } else {
      errorKey = null;
      patch.downloadErrorSince = null;
    }

    if (status.lastSyncedAt) patch.lastSyncedAt = status.lastSyncedAt.getTime();
    store.updateConnection(patch);
  }

  // A throwing listener would stop PowerSync from notifying the ones after it.
  function safeHandle(status: ConnectionStatusLike): void {
    try {
      handle(status);
    } catch (error) {
      console.warn('[SyncActivity] Connection tracking failed:', error);
    }
  }

  safeHandle(db.currentStatus);
  const unregister = db.registerListener({ statusChanged: safeHandle });

  return () => {
    unregister();
    cancelDisconnectEntry();
  };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function browserOnline(): boolean | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.onLine;
}
