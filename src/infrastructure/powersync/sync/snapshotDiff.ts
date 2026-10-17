/**
 * Table snapshots and their diff — how the download tracker sees what changed.
 *
 * PowerSync tells us which tables changed, not which rows. The tracker keeps
 * an in-memory snapshot per table (id → row signature) and diffs the next
 * snapshot against it to find created, updated and deleted rows.
 */

import type { SyncChangeOp } from './types';

type Row = Record<string, unknown>;

export type TableSnapshot = Map<string, { signature: string; row: Row }>;

export interface RowDiff {
  op: SyncChangeOp;
  id: string;
  /** Current data; for a removed row, its last known data. */
  row: Row;
  previous: Row | null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Indexes rows by id. Rows without a non-empty string `id` are skipped. */
export function snapshotFromRows(rows: Row[]): TableSnapshot {
  const snapshot: TableSnapshot = new Map();
  for (const row of rows) {
    const id = row['id'];
    if (typeof id !== 'string' || id === '') continue;
    snapshot.set(id, { signature: signatureOf(row), row });
  }
  return snapshot;
}

/**
 * Rows created, updated or removed between two snapshots of one table.
 * An update that sets a previously empty `deleted_at` is a (soft) delete.
 * Ids in `excludedIds` (local writes and their echoes) are skipped.
 */
export function diffSnapshots(prev: TableSnapshot, next: TableSnapshot, excludedIds: ReadonlySet<string>): RowDiff[] {
  const diffs: RowDiff[] = [];

  for (const [id, current] of next) {
    if (excludedIds.has(id)) continue;
    const before = prev.get(id);
    if (!before) {
      diffs.push({ op: 'create', id, row: current.row, previous: null });
    } else if (before.signature !== current.signature) {
      const op = !isSoftDeleted(before.row) && isSoftDeleted(current.row) ? 'delete' : 'update';
      diffs.push({ op, id, row: current.row, previous: before.row });
    }
  }

  for (const [id, before] of prev) {
    if (next.has(id) || excludedIds.has(id)) continue;
    diffs.push({ op: 'delete', id, row: before.row, previous: before.row });
  }

  return diffs;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** JSON with sorted keys, so column order never reads as a change. Rows are flat. */
function signatureOf(row: Row): string {
  return JSON.stringify(row, Object.keys(row).sort());
}

function isSoftDeleted(row: Row): boolean {
  const deletedAt = row['deleted_at'];
  return typeof deletedAt === 'string' && deletedAt.trim() !== '';
}
