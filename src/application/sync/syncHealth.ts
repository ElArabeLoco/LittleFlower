/**
 * Sync health — one derived state for the sync UI.
 *
 * Combines the PowerSync status, the session activity log, the upload queue
 * size and the browser online state into a single state + optional alert.
 * Pure: time comes in as `now`, and `nextCheckAt` tells the caller when the
 * result may change on its own (an alert delay running out).
 *
 * Rules, first match wins:
 *   1. Upload problem (unresolved failure or status upload error):
 *      auth → error + auth alert; offline → falls through to rule 2;
 *      anything else → error + upload-rejected alert, immediately.
 *   2. Offline (browser offline, or stream stopped): state offline; info alert
 *      only once it has lasted OFFLINE_ALERT_DELAY_MS since disconnectedSince.
 *   3. Download/connection error: syncing during CONNECTION_ALERT_DELAY_MS
 *      (PowerSync retries on its own), then error + auth or connection alert.
 *   4. Uploading / downloading / connecting → syncing.
 *   5. Changes waiting in the upload queue → pending.
 *   6. Synced.
 */

import type { SyncErrorInfo } from '@/infrastructure/powersync/sync';

export type SyncHealthState = 'synced' | 'syncing' | 'pending' | 'offline' | 'error';
export type SyncAlertKind = 'offline' | 'upload-rejected' | 'auth' | 'connection';
export type SyncAlertSeverity = 'info' | 'warning' | 'error';

export interface SyncAlert {
  kind: SyncAlertKind;
  severity: SyncAlertSeverity;
}

export interface SyncHealthInput {
  connected: boolean;
  connecting: boolean;
  uploading: boolean;
  downloading: boolean;
  hasUploadError: boolean;
  hasDownloadError: boolean;
  /** Newest unresolved upload failure in this tab's activity store (the classification to trust). */
  uploadFailure: SyncErrorInfo | null;
  /** status.uploadError classified from its message only — fallback when this tab logged no failure. */
  uploadError: SyncErrorInfo | null;
  /** status.downloadError, classified. */
  downloadError: SyncErrorInfo | null;
  pendingCount: number;
  online: boolean;
  disconnectedSince: number | null;
  downloadErrorSince: number | null;
  now: number;
}

export interface SyncHealth {
  state: SyncHealthState;
  pendingCount: number;
  /** The problem behind the 'error' state; null in every other state. */
  error: SyncErrorInfo | null;
  alert: SyncAlert | null;
  /** When the derived state may change on its own (for timers), or null. */
  nextCheckAt: number | null;
}

export const OFFLINE_ALERT_DELAY_MS = 5_000;
export const CONNECTION_ALERT_DELAY_MS = 10_000;

const AUTH_ALERT: SyncAlert = { kind: 'auth', severity: 'error' };
const UPLOAD_REJECTED_ALERT: SyncAlert = { kind: 'upload-rejected', severity: 'error' };
const CONNECTION_ALERT: SyncAlert = { kind: 'connection', severity: 'warning' };
const OFFLINE_ALERT: SyncAlert = { kind: 'offline', severity: 'info' };

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function deriveSyncHealth(input: SyncHealthInput): SyncHealth {
  const { pendingCount, now } = input;
  const health = (state: SyncHealthState, extra: Partial<SyncHealth> = {}): SyncHealth => ({
    state,
    pendingCount,
    error: null,
    alert: null,
    nextCheckAt: null,
    ...extra,
  });

  // 1. Upload problems. A logged failure only counts while something is still
  //    queued: the failing transaction stays in the queue until it uploads.
  const loggedFailure = pendingCount > 0 ? input.uploadFailure : null;
  if (loggedFailure !== null || input.hasUploadError) {
    const error = loggedFailure ?? input.uploadError;
    if (error?.kind === 'auth') return health('error', { error, alert: AUTH_ALERT });
    if (error?.kind !== 'offline') return health('error', { error, alert: UPLOAD_REJECTED_ALERT });
    // An offline failure is not an error: the offline rules decide.
  }

  // 2. Offline. (While PowerSync retries, `connecting` stays true, so a
  //    stopped stream here means it is not trying at all.)
  if (!input.online || (!input.connected && !input.connecting)) {
    const since = input.disconnectedSince;
    if (since === null) return health('offline');
    const alertAt = since + OFFLINE_ALERT_DELAY_MS;
    return now >= alertAt ? health('offline', { alert: OFFLINE_ALERT }) : health('offline', { nextCheckAt: alertAt });
  }

  // 3. Download / connection errors: let PowerSync's own retries try first.
  if (input.hasDownloadError) {
    const since = input.downloadErrorSince;
    if (since === null) return health('syncing');
    const alertAt = since + CONNECTION_ALERT_DELAY_MS;
    if (now < alertAt) return health('syncing', { nextCheckAt: alertAt });
    const error = input.downloadError;
    return health('error', { error, alert: error?.kind === 'auth' ? AUTH_ALERT : CONNECTION_ALERT });
  }

  // 4–6.
  if (input.uploading || input.downloading || input.connecting) return health('syncing');
  if (pendingCount > 0) return health('pending');
  return health('synced');
}
