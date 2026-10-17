/**
 * Table snapshots and their diff — how the download tracker sees what changed.
 *
 * PowerSync tells us which tables changed, not which rows. The tracker keeps
 * a compact snapshot per table and diffs the next one against it to find
 * created, updated and deleted rows. Per row it keeps only:
 *   - a short signature (32-bit FNV-1a of the row's stable JSON), which
 *     detects a change in any column, and
 *   - the few fields needed to describe the row (DESCRIBED_COLUMNS), so a
 *     row can still be described after it is gone.
 */

import { describedFields } from './describeRecord';
import type { SyncChangeOp } from './types';

type Row = Record<string, unknown>;

export interface SnapshotEntry {
  signature: string;
  /** The row's DESCRIBED_COLUMNS only. */
  fields: Row;
}

export type TableSnapshot = Map<string, SnapshotEntry>;

export interface RowDiff {
  op: SyncChangeOp;
  id: string;
  /** Kept fields of the current row; for a removed row, its last kept fields. */
  fields: Row;
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
    snapshot.set(id, { signature: fnv1a32(stableJson(row)), fields: describedFields(row) });
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
      diffs.push({ op: 'create', id, fields: current.fields, previous: null });
    } else if (before.signature !== current.signature) {
      const op = !isSoftDeleted(before.fields) && isSoftDeleted(current.fields) ? 'delete' : 'update';
      diffs.push({ op, id, fields: current.fields, previous: before.fields });
    }
  }

  for (const [id, before] of prev) {
    if (next.has(id) || excludedIds.has(id)) continue;
    diffs.push({ op: 'delete', id, fields: before.fields, previous: before.fields });
  }

  return diffs;
}

/** 32-bit FNV-1a over the string's UTF-16 code units, as 8 hex digits. */
export function fnv1a32(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** JSON with sorted keys, so column order never reads as a change. Rows are flat. */
function stableJson(row: Row): string {
  return JSON.stringify(row, Object.keys(row).sort());
}

function isSoftDeleted(fields: Row): boolean {
  const deletedAt = fields['deleted_at'];
  return typeof deletedAt === 'string' && deletedAt.trim() !== '';
}
