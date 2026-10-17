/**
 * Sync activity store — the session log of what went up and what came down.
 *
 * A tiny external store (useSyncExternalStore contract): every change
 * produces a new immutable SyncActivityState and getSnapshot() returns the
 * same object until the next change. Lives in memory only; a reload starts a
 * new session.
 *
 * Writers:
 *   - SupabaseConnector.uploadData → recordUpload / recordUploadFailure
 *   - download tracker            → recordDownload
 *   - connection tracker          → recordConnection / updateConnection
 *   - upload id sharing (tabs)    → rememberUploadedIds (reads onUpload)
 */

import type {
  SyncActivityEvent,
  SyncActivityState,
  SyncConnectionTimeline,
  SyncErrorInfo,
  SyncRecordChange,
} from './types';

export type SyncUploadFailedEvent = Extract<SyncActivityEvent, { kind: 'upload-failed' }>;
export type SyncConnectionState = Extract<SyncActivityEvent, { kind: 'connection' }>['state'];

export interface SyncActivityStoreOptions {
  now?: () => number;
  /** Ring buffer size — only the newest events are kept. */
  maxEvents?: number;
  idFactory?: () => string;
}

export interface SyncActivityStore {
  getSnapshot(): SyncActivityState;
  subscribe(listener: () => void): () => void;
  recordUpload(changes: SyncRecordChange[]): void;
  recordUploadFailure(changes: SyncRecordChange[], error: SyncErrorInfo): void;
  recordDownload(changes: SyncRecordChange[], total?: number): void;
  recordConnection(state: SyncConnectionState, error?: SyncErrorInfo | null): void;
  updateConnection(patch: Partial<SyncConnectionTimeline>): void;
  /** Ids uploaded within the last `windowMs` (at most the last 10 minutes). */
  recentlyUploadedIds(windowMs: number): Set<string>;
  /**
   * Remembers ids uploaded by another tab: they count as recent uploads and
   * resolve matching failures, but log no upload and notify no onUpload
   * listener (so tabs never echo each other).
   */
  rememberUploadedIds(ids: Iterable<string>): void;
  /** Called with the unique record ids of every upload recorded here. */
  onUpload(listener: (ids: string[]) => void): () => void;
  /** Empties the log; keeps the session start and the connection timeline. */
  clear(): void;
}

/** How long uploaded ids are remembered to recognise their download echo. */
const UPLOADED_ID_RETENTION_MS = 10 * 60_000;

const TIMELINE_KEYS = ['connectedAt', 'disconnectedSince', 'downloadErrorSince', 'lastSyncedAt'] as const;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSyncActivityStore({
  now = Date.now,
  maxEvents = 200,
  idFactory,
}: SyncActivityStoreOptions = {}): SyncActivityStore {
  let sequence = 0;
  const nextId = idFactory ?? (() => `sync-${++sequence}`);
  const listeners = new Set<() => void>();
  const uploadListeners = new Set<(ids: string[]) => void>();
  /** Record id → last successful upload time. */
  const uploadedAt = new Map<string, number>();
  /** Dedupe key (see connectionKey) of the last recorded connection event. */
  let lastConnectionKey: string | null = null;

  let state: SyncActivityState = {
    sessionStartedAt: now(),
    events: [],
    connection: { connectedAt: null, disconnectedSince: null, downloadErrorSince: null, lastSyncedAt: null },
  };

  function commit(next: SyncActivityState): void {
    state = next;
    for (const listener of [...listeners]) notifySafely(listener);
  }

  function setEvents(events: SyncActivityEvent[]): void {
    commit({ ...state, events: events.length > maxEvents ? events.slice(0, maxEvents) : events });
  }

  function pruneUploadedIds(at: number): void {
    for (const [id, uploaded] of uploadedAt) {
      if (at - uploaded > UPLOADED_ID_RETENTION_MS) uploadedAt.delete(id);
    }
  }

  /**
   * Remembers `ids` as uploaded at `at` and returns the events with every
   * unresolved failure touching them marked resolved (same array if none).
   * The queue only moves forward once the failing transaction succeeds, so
   * an upload touching a failed record means that failure is over.
   */
  function markUploaded(ids: ReadonlySet<string>, at: number): SyncActivityEvent[] {
    for (const id of ids) uploadedAt.set(id, at);
    pruneUploadedIds(at);

    let resolved = false;
    const events = state.events.map((event) => {
      if (event.kind !== 'upload-failed' || event.resolvedAt !== null) return event;
      if (!event.changes.some((change) => ids.has(change.id))) return event;
      resolved = true;
      return { ...event, resolvedAt: at };
    });
    return resolved ? events : state.events;
  }

  return {
    getSnapshot: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    recordUpload(changes) {
      const at = now();
      const ids = new Set(changes.map((change) => change.id));
      const events = markUploaded(ids, at);
      setEvents([{ id: nextId(), kind: 'upload', at, changes }, ...events]);

      const uploadedIds = [...ids];
      for (const listener of [...uploadListeners]) notifySafely(listener, uploadedIds);
    },

    rememberUploadedIds(ids) {
      const events = markUploaded(new Set(ids), now());
      if (events !== state.events) setEvents(events);
    },

    onUpload(listener) {
      uploadListeners.add(listener);
      return () => {
        uploadListeners.delete(listener);
      };
    },

    recordUploadFailure(changes, error) {
      const at = now();

      // PowerSync retries the same transaction every few seconds: fold
      // identical retries into the latest matching unresolved row (wherever
      // downloads or connection changes pushed it) and move it to the top.
      const retried = state.events.find(
        (event): event is SyncUploadFailedEvent =>
          event.kind === 'upload-failed' &&
          event.resolvedAt === null &&
          event.error.message === error.message &&
          sameRecordIds(event.changes, changes),
      );
      if (retried) {
        setEvents([
          { ...retried, attempts: retried.attempts + 1, lastAttemptAt: at, changes, error },
          ...state.events.filter((event) => event !== retried),
        ]);
        return;
      }

      setEvents([
        { id: nextId(), kind: 'upload-failed', at, lastAttemptAt: at, attempts: 1, changes, error, resolvedAt: null },
        ...state.events,
      ]);
    },

    recordDownload(changes, total = changes.length) {
      if (changes.length === 0) return;
      setEvents([{ id: nextId(), kind: 'download', at: now(), changes, total }, ...state.events]);
    },

    recordConnection(connectionState, error = null) {
      // Dedupe against the last connection event, not the newest event:
      // uploads and downloads in between do not make a repeat meaningful.
      const key = connectionKey(connectionState, error);
      if (key === lastConnectionKey) return;
      lastConnectionKey = key;
      setEvents([{ id: nextId(), kind: 'connection', at: now(), state: connectionState, error }, ...state.events]);
    },

    updateConnection(patch) {
      const next: SyncConnectionTimeline = { ...state.connection };
      let changed = false;
      for (const key of TIMELINE_KEYS) {
        const value = patch[key];
        if (value === undefined || value === next[key]) continue;
        next[key] = value;
        changed = true;
      }
      if (changed) commit({ ...state, connection: next });
    },

    recentlyUploadedIds(windowMs) {
      const at = now();
      pruneUploadedIds(at);
      const ids = new Set<string>();
      for (const [id, uploaded] of uploadedAt) {
        if (at - uploaded <= windowMs) ids.add(id);
      }
      return ids;
    },

    clear() {
      if (state.events.length === 0) return;
      commit({ ...state, events: [] });
    },
  };
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/** Newest upload failure that no later upload has resolved, or null. */
export function selectUnresolvedUploadFailure(state: SyncActivityState): SyncUploadFailedEvent | null {
  return (
    state.events.find(
      (event): event is SyncUploadFailedEvent => event.kind === 'upload-failed' && event.resolvedAt === null,
    ) ?? null
  );
}

// ---------------------------------------------------------------------------
// App-wide instance
// ---------------------------------------------------------------------------

export const syncActivity: SyncActivityStore = createSyncActivityStore();

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Listeners are outside code. One that throws must neither stop the others
 * nor reach the writer: the connector records uploads, and a logging
 * problem must never change an upload's outcome.
 */
function notifySafely<A extends unknown[]>(listener: (...args: A) => void, ...args: A): void {
  try {
    listener(...args);
  } catch (error) {
    console.warn('[SyncActivity] A listener failed:', error);
  }
}

/**
 * Errors are compared by kind and code, never by message: sync service
 * messages carry request ids, so the same failure reads differently each time.
 */
function connectionKey(state: SyncConnectionState, error: SyncErrorInfo | null): string {
  return error ? `${state}|${error.kind}|${error.code ?? ''}` : state;
}

function sameRecordIds(a: SyncRecordChange[], b: SyncRecordChange[]): boolean {
  const left = new Set(a.map((change) => change.id));
  const right = new Set(b.map((change) => change.id));
  return left.size === right.size && [...left].every((id) => right.has(id));
}
