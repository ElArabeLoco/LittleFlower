/**
 * Sync error classification.
 *
 * Turns Supabase/PostgREST errors (upload path) and arbitrary thrown values
 * (connection/download path) into a SyncErrorInfo the UI can reason about:
 *
 *   offline  — the request never reached the server
 *   auth     — the session/JWT is missing, expired or invalid
 *   rejected — the server refused the data (constraints, RLS, schema)
 *   server   — the backend is failing (5xx, database unavailable)
 *   unknown  — anything else
 *
 * Errors thrown by the sync worker reach the tab without custom properties,
 * so the message heuristics matter as much as codes and HTTP statuses.
 */

import type { SyncErrorInfo, SyncErrorKind } from './types';

// ---------------------------------------------------------------------------
// SyncUploadError
// ---------------------------------------------------------------------------

/** Error thrown by the connector when uploading a CRUD entry fails. */
export class SyncUploadError extends Error {
  readonly info: SyncErrorInfo;

  constructor(info: SyncErrorInfo, options?: ErrorOptions) {
    super(
      info.table && info.op ? `Supabase ${info.op} failed on ${info.table}: ${info.message}` : info.message,
      options,
    );
    this.name = 'SyncUploadError';
    this.info = info;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

interface SupabaseErrorLike {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

interface SupabaseErrorContext {
  status?: number | null;
  table?: string | null;
  op?: string | null;
  recordId?: string | null;
}

/** Classifies a PostgREST error returned by a Supabase table request. */
export function classifySupabaseError(error: SupabaseErrorLike, ctx: SupabaseErrorContext): SyncErrorInfo {
  const status = typeof ctx.status === 'number' ? ctx.status : null;
  return buildInfo({ ...readSignal(error), status }, ctx);
}

/**
 * Classifies any thrown value. `online` is `navigator.onLine` when known:
 * while the browser is offline every failure is reported as offline.
 */
export function classifySyncError(error: unknown, online?: boolean): SyncErrorInfo {
  if (error instanceof SyncUploadError) {
    return online === false ? { ...error.info, kind: 'offline' } : error.info;
  }
  return buildInfo(readSignal(error), {}, online);
}

// ---------------------------------------------------------------------------
// Classification rules — first match wins
// ---------------------------------------------------------------------------

const OFFLINE_MESSAGE =
  /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet_disconnected|err_network/i;
const AUTH_MESSAGE =
  /jwt|token (is )?expired|no active supabase session|not authenticated|unauthori[sz]ed|PSYNC_S21\d\d/i;
const SERVER_MESSAGE = /service unavailable|bad gateway|gateway timeout|internal server error/i;

/** PostgREST JWT errors (decode failure, anonymous disabled, claims validation). */
const AUTH_CODES = new Set(['PGRST301', 'PGRST302', 'PGRST303']);
/** SQLSTATE classes 22 (data exception), 23 (integrity) and 42 (access rule, incl. 42501 RLS). */
const SQLSTATE_REJECTED = /^(22|23|42)[0-9A-Z]{3}$/;
/** PostgREST request (1xx) and schema cache (2xx) errors, e.g. PGRST116 / PGRST204. */
const POSTGREST_REJECTED = /^PGRST[12]\d{2}$/;
/** PostgREST database connection / pool errors. */
const POSTGREST_SERVER = /^PGRST00[0-3]$/;
const REJECTED_STATUSES = new Set([400, 409, 422]);

interface ErrorSignal {
  message: string;
  code: string | null;
  status: number | null;
}

function classifyKind({ message, code, status }: ErrorSignal, online?: boolean): SyncErrorKind {
  if (online === false || status === 0 || OFFLINE_MESSAGE.test(message)) return 'offline';

  // A SQLSTATE rejection is the server's verdict on the data; never let the
  // auth message heuristic override it (e.g. a 403 with 42501 is RLS, not auth).
  const sqlRejection = code !== null && SQLSTATE_REJECTED.test(code);

  if ((code !== null && AUTH_CODES.has(code)) || status === 401 || (!sqlRejection && AUTH_MESSAGE.test(message))) {
    return 'auth';
  }
  if (
    sqlRejection ||
    (code !== null && POSTGREST_REJECTED.test(code)) ||
    (status !== null && REJECTED_STATUSES.has(status))
  ) {
    return 'rejected';
  }
  if (
    (status !== null && status >= 500) ||
    (code !== null && POSTGREST_SERVER.test(code)) ||
    SERVER_MESSAGE.test(message)
  ) {
    return 'server';
  }
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

const CRUD_OPS = new Set(['PUT', 'PATCH', 'DELETE']);

function buildInfo(signal: ErrorSignal, ctx: SupabaseErrorContext, online?: boolean): SyncErrorInfo {
  return {
    kind: classifyKind(signal, online),
    message: signal.message,
    code: signal.code,
    status: signal.status,
    table: nonEmpty(ctx.table),
    op: ctx.op && CRUD_OPS.has(ctx.op) ? (ctx.op as SyncErrorInfo['op']) : null,
    recordId: nonEmpty(ctx.recordId),
  };
}

/** Extracts message / code / status from any thrown value. */
function readSignal(error: unknown): ErrorSignal {
  if (typeof error === 'string') return { message: composeMessage(error, null), code: null, status: null };
  if (typeof error !== 'object' || error === null) return { message: composeMessage(undefined, null), code: null, status: null };

  const { message, details, code, status } = error as Record<string, unknown>;
  return {
    message: composeMessage(
      typeof message === 'string' ? message : undefined,
      typeof details === 'string' ? details : null,
    ),
    code: typeof code === 'string' ? nonEmpty(code) : null,
    status: typeof status === 'number' ? status : null,
  };
}

/**
 * `message (details)`. Multi-line details are skipped: postgrest-js puts the
 * fetch stack trace there on network failures, which is noise in the UI and
 * would make otherwise identical retries look different.
 */
function composeMessage(message: string | undefined, details: string | null | undefined): string {
  const base = message?.trim() || 'Unknown error';
  const extra = details?.trim();
  if (!extra || extra.includes('\n') || base.includes(extra)) return base;
  return `${base} (${extra})`;
}

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
