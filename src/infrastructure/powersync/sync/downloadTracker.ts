/**
 * Download tracker — logs what came down from the server.
 *
 * PowerSync reports which tables changed, not which rows or why. The tracker
 * keeps a compact snapshot of every tracked table and, once PowerSync has
 * applied a downloaded checkpoint, re-reads the tables that changed and
 * diffs them. Changes that are ours are skipped:
 *   - local writes still waiting in the upload queue (ps_crud), and
 *   - writes uploaded since the previous run (the server echoes them back).
 * What remains came from the household partner (or another device) and is
 * recorded as ONE download event per run. On a fresh device the first
 * checkpoint brings everything at once: that event is marked `initial`.
 *
 * Local writes alone never rescan a table: they only mark it dirty until the
 * next checkpoint. Runs are serial, and failures never reach the app.
 */

import type { SQLOnChangeOptions, WatchOnChangeHandler } from '@powersync/web';
import { describeRow } from './describeRecord';
import type { LabelCache, LabelTable } from './labelCache';
import { diffSnapshots, snapshotFromRows, type RowDiff, type TableSnapshot } from './snapshotDiff';
import type { SyncActivityStore } from './syncActivityStore';

/** The slice of PowerSync's SyncStatus the tracker reads. */
export interface DownloadTrackerStatus {
  readonly hasSynced?: boolean;
  readonly lastSyncedAt?: Date;
  readonly dataFlowStatus: { readonly downloading?: boolean };
}

/** The slice of the PowerSync database the tracker needs. */
export interface DownloadTrackerDb {
  readonly currentStatus: DownloadTrackerStatus;
  waitForReady(): Promise<void>;
  getAll<T>(sql: string, parameters?: unknown[]): Promise<T[]>;
  onChange(handler: WatchOnChangeHandler, options?: SQLOnChangeOptions): () => void;
  registerListener(listener: { statusChanged?: (status: DownloadTrackerStatus) => void }): () => void;
}

export interface DownloadTrackingOptions {
  db: DownloadTrackerDb;
  store: Pick<SyncActivityStore, 'recordDownload' | 'recentlyUploadedIds'>;
  labelCache: LabelCache;
  /** Fixed allowlist derived from AppSchema — never user input. */
  tables: readonly string[];
  throttleMs?: number;
  now?: () => number;
}

/** Uploads at least this recent count as echoes, even right after a run. */
const ECHO_WINDOW_MS = 120_000;
/**
 * Table changes reported this soon after an applied checkpoint belong to it:
 * the status arrives before our (throttled) change callback.
 */
const CHECKPOINT_SETTLE_MS = 2_000;
/** Changes kept per download event; the event's `total` still counts all. */
const MAX_CHANGES_PER_EVENT = 50;
/** Table names are interpolated into SQL: only plain identifiers get there. */
const SAFE_TABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
/** onChange reports PowerSync's internal table names. */
const INTERNAL_TABLE_PREFIX = /^ps_data(?:_local)?__/;
const LABEL_TABLES: readonly LabelTable[] = ['budgets', 'incomes', 'debts', 'assets'];

type Row = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Starts tracking downloads; returns a function that stops it. */
export function startDownloadTracking({
  db,
  store,
  labelCache,
  tables,
  throttleMs = 150,
  now = Date.now,
}: DownloadTrackingOptions): () => void {
  const tracked = tables.filter((table) => {
    if (SAFE_TABLE_NAME.test(table)) return true;
    console.warn('[SyncActivity] Not tracking a table with an unsafe name:', table);
    return false;
  });
  const trackedSet = new Set(tracked);
  const snapshots = new Map<string, TableSnapshot>();
  const dirty = new Set<string>();
  let ready = false;
  let running = false;
  let stopped = false;

  /** Status values the next applied checkpoint is detected against. */
  let lastSyncedAt: number | null = null;
  let downloading = false;
  /** When the latest / the first checkpoint of this session was applied. */
  let checkpointAt: number | null = null;
  let firstCheckpointAt: number | null = null;
  /** When the previous run started: writes uploaded since then are echoes. */
  let lastRunAt = 0;
  /** Empty tables on a device that never synced: the first checkpoint brings everything. */
  let freshDevice = false;
  /** Whether the run that could be the initial one already happened. */
  let initialDecided = false;

  async function takeBaseline(): Promise<void> {
    try {
      await db.waitForReady();
      for (const table of tracked) {
        snapshots.set(table, snapshotFromRows(await readTable(table)));
      }
      const status = db.currentStatus;
      lastSyncedAt = status.lastSyncedAt?.getTime() ?? null;
      downloading = status.dataFlowStatus?.downloading === true;
      freshDevice = status.hasSynced !== true && [...snapshots.values()].every((snapshot) => snapshot.size === 0);
      lastRunAt = now();
      refreshLabels();
      ready = true;
      schedule();
    } catch (error) {
      console.warn('[SyncActivity] Download tracking could not start:', error);
    }
  }

  /** A new lastSyncedAt, or a download that just finished, means a checkpoint was applied. */
  function onStatus(status: DownloadTrackerStatus): void {
    if (!ready) return; // The baseline starts from the status at that moment.
    const syncedAt = status.lastSyncedAt?.getTime() ?? null;
    const isDownloading = status.dataFlowStatus?.downloading === true;
    const applied = (syncedAt !== null && syncedAt !== lastSyncedAt) || (downloading && !isDownloading);
    if (syncedAt !== null) lastSyncedAt = syncedAt;
    downloading = isDownloading;
    if (!applied) return;

    checkpointAt = now();
    firstCheckpointAt ??= checkpointAt;
    schedule();
  }

  function inCheckpointWindow(): boolean {
    return checkpointAt !== null && now() - checkpointAt <= CHECKPOINT_SETTLE_MS;
  }

  /** Diffs dirty tables only around an applied checkpoint; local writes wait for the next one. */
  function schedule(): void {
    if (!ready || running || stopped || dirty.size === 0 || !inCheckpointWindow()) return;
    running = true;
    void drain();
  }

  async function drain(): Promise<void> {
    try {
      while (dirty.size > 0 && !stopped && inCheckpointWindow()) {
        const batch = [...dirty];
        dirty.clear();
        try {
          await processRun(batch);
        } catch (error) {
          // Snapshots were not advanced: the tables stay dirty for the next checkpoint.
          for (const table of batch) dirty.add(table);
          console.warn('[SyncActivity] Download tracking run failed:', error);
          break;
        }
      }
    } finally {
      running = false;
    }
  }

  async function processRun(batch: string[]): Promise<void> {
    const runStartedAt = now();

    // Tables first, then what is ours: a local write landing in between is
    // then either missing from the tables read, or already pending / uploaded
    // when ps_crud and the upload memory are read — never logged as received.
    const nextSnapshots = new Map<string, TableSnapshot>();
    for (const table of batch) {
      nextSnapshots.set(table, snapshotFromRows(await readTable(table)));
    }
    const excluded = await pendingUploadIds();
    const echoWindow = Math.max(ECHO_WINDOW_MS, runStartedAt - lastRunAt);
    for (const id of store.recentlyUploadedIds(echoWindow)) excluded.add(id);
    if (stopped) return;
    lastRunAt = runStartedAt;

    const diffs: { table: string; diff: RowDiff }[] = [];
    for (const [table, next] of nextSnapshots) {
      for (const diff of diffSnapshots(snapshots.get(table) ?? new Map(), next, excluded)) {
        diffs.push({ table, diff });
      }
      snapshots.set(table, next);
    }

    // Before describing: names that arrived in this run label its changes.
    refreshLabels();

    const changes = diffs.map(({ table, diff }) =>
      describeRow(table, diff.op, diff.id, diff.fields, labelCache.getName),
    );

    // Only the run right after the session's first checkpoint can be the
    // fresh device's initial sync.
    const initial =
      !initialDecided &&
      freshDevice &&
      firstCheckpointAt !== null &&
      runStartedAt - firstCheckpointAt <= CHECKPOINT_SETTLE_MS;
    if (firstCheckpointAt !== null) initialDecided = true;

    if (changes.length > 0) {
      store.recordDownload(changes.slice(0, MAX_CHANGES_PER_EVENT), changes.length, { initial });
    }
  }

  function readTable(table: string): Promise<Row[]> {
    return db.getAll<Row>(`SELECT * FROM ${table}`);
  }

  /** Ids of local writes still waiting to be uploaded. */
  async function pendingUploadIds(): Promise<Set<string>> {
    const rows = await db.getAll<{ data: string }>('SELECT data FROM ps_crud');
    const ids = new Set<string>();
    for (const { data } of rows) {
      try {
        const id = (JSON.parse(data) as { id?: unknown }).id;
        if (typeof id === 'string') ids.add(id);
      } catch {
        // Not a CRUD entry we understand — nothing to exclude.
      }
    }
    return ids;
  }

  /** Rebuilds budget / income / debt / asset names from the current snapshots. */
  function refreshLabels(): void {
    for (const table of LABEL_TABLES) {
      const snapshot = snapshots.get(table);
      if (!snapshot) continue;
      const names = new Map<string, string>();
      for (const [id, { fields }] of snapshot) {
        const name = fields['name'];
        if (typeof name === 'string' && name.trim() !== '') names.set(id, name.trim());
      }
      labelCache.setNames(table, names);
    }
  }

  // Only collect here, synchronously: while a handler is still running,
  // PowerSync keeps just the latest pending event and drops the others.
  const unsubscribe = db.onChange(
    {
      onChange: ({ changedTables }) => {
        for (const name of changedTables) {
          const table = name.replace(INTERNAL_TABLE_PREFIX, '');
          if (trackedSet.has(table)) dirty.add(table);
        }
        schedule();
      },
      onError: (error) => console.warn('[SyncActivity] Change watch failed:', error),
    },
    { tables: tracked, throttleMs },
  );
  const unregister = db.registerListener({ statusChanged: onStatus });

  void takeBaseline();

  return () => {
    stopped = true;
    unsubscribe();
    unregister();
  };
}
