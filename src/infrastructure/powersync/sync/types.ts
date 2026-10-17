/**
 * Sync activity model — shared types.
 *
 * Describes what went up (uploads), what came down (downloads) and how the
 * PowerSync connection behaved during the current session. Everything here is
 * plain serializable data: the activity store keeps these objects immutable
 * and the diagnostics export prints them as JSON.
 */

// ---------------------------------------------------------------------------
// Record changes
// ---------------------------------------------------------------------------

export type SyncChangeOp = 'create' | 'update' | 'delete';

/** Human-oriented description of one changed row. */
export interface SyncRecordChange {
  table: string;
  op: SyncChangeOp;
  id: string;
  /** Name, note, or the related budget/income/debt name. */
  label: string | null;
  /** Integer COP unless `currency` says otherwise; exchange rates carry the rate. */
  amount: number | null;
  currency: string | null;
  /** 'YYYY-MM' */
  month: string | null;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type SyncErrorKind = 'offline' | 'auth' | 'rejected' | 'server' | 'unknown';

export interface SyncErrorInfo {
  kind: SyncErrorKind;
  message: string;
  code: string | null;
  status: number | null;
  table: string | null;
  op: 'PUT' | 'PATCH' | 'DELETE' | null;
  recordId: string | null;
}

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------

export type SyncActivityEvent =
  | { id: string; kind: 'upload'; at: number; changes: SyncRecordChange[] }
  | {
      id: string;
      kind: 'upload-failed';
      at: number;
      lastAttemptAt: number;
      attempts: number;
      changes: SyncRecordChange[];
      error: SyncErrorInfo;
      resolvedAt: number | null;
    }
  | {
      id: string;
      kind: 'download';
      at: number;
      changes: SyncRecordChange[];
      total: number;
      /** A fresh device's first sync: everything arrived at once, not from other devices. */
      initial?: boolean;
    }
  | {
      id: string;
      kind: 'connection';
      at: number;
      state: 'connected' | 'disconnected' | 'error';
      error: SyncErrorInfo | null;
    };

export interface SyncConnectionTimeline {
  connectedAt: number | null;
  disconnectedSince: number | null;
  downloadErrorSince: number | null;
  lastSyncedAt: number | null;
}

export interface SyncActivityState {
  sessionStartedAt: number;
  /** Newest first. */
  events: SyncActivityEvent[];
  connection: SyncConnectionTimeline;
}
