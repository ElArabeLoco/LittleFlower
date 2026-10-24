/**
 * PowerSyncAssetRepository — writes assets, their holders and their value
 * history (asset_valuations).
 *
 * `assets.value` / `assets.currency` hold the current value: the latest
 * active valuation by date. Every write that touches valuations recomputes
 * them in the same transaction.
 *
 * Reads go through the reactive hooks in queries/useAssetQueries.ts.
 */

import { db } from '../client';
import { newId, now, authorshipStamp, assertAuth, type Executor } from '../mutationHelpers';
import { setHolders } from './PowerSyncMemberRepository';
import { getToday } from '@/shared/helpers';
import type { AssetCurrency, AssetKind } from '@/domain/asset/Asset';
import { initialValuationId } from '@/domain/asset/assetValuation';

export interface InsertAssetPayload {
  household_id: string;
  name: string;
  kind: AssetKind;
  /** Integer in `currency` */
  value: number;
  currency: AssetCurrency;
  created_by: string;
}

/**
 * Writes the asset, its first valuation (today) and its holders (`holderIds`,
 * empty = the whole household) in ONE transaction.
 */
export async function insertAsset(
  payload: InsertAssetPayload,
  userId: string,
  holderIds: string[],
): Promise<string> {
  assertAuth(payload.household_id, userId);
  const id = newId();
  await db.writeTransaction(async tx => {
    await writeAssetRow(tx, id, payload, userId);
    await writeValuationRow(tx, initialValuationId(id), {
      householdId: payload.household_id,
      assetId: id,
      value: payload.value,
      currency: payload.currency,
      valuedOn: getToday(),
      note: null,
      createdBy: userId,
      createdAt: now(),
    });
    await setHolders(tx, {
      householdId: payload.household_id,
      subjectType: 'asset',
      subjectId: id,
      memberIds: holderIds,
      userId,
    });
  });
  return id;
}

async function writeAssetRow(
  exec: Executor,
  id: string,
  payload: InsertAssetPayload,
  userId: string,
): Promise<void> {
  const stamp = authorshipStamp(userId);
  const ts = now();
  await exec.execute(
    `INSERT INTO assets
       (id, household_id, name, kind, value, currency,
        created_by, created_at, updated_at, last_edited_by, last_edited_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payload.household_id,
      payload.name.trim(),
      payload.kind,
      payload.value,
      payload.currency,
      payload.created_by,
      ts,
      ts,
      stamp.last_edited_by,
      stamp.last_edited_at,
    ],
  );
}

/**
 * Edits the asset's details. The value is not edited here: it changes with
 * addAssetValuation, so every change stays in the history.
 *
 * `holderIds` (optional): the complete list of holders after the update.
 * `undefined` leaves holders untouched, `[]` removes them all. When given,
 * the asset update and the holders are written in ONE transaction — and the
 * holders apply even when `patch` has no fields.
 */
export async function updateAsset(
  id: string,
  patch: Partial<Pick<InsertAssetPayload, 'name' | 'kind'>>,
  userId: string,
  holderIds?: string[],
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.name !== undefined) { fields.push('name = ?'); values.push(patch.name.trim()); }
  if (patch.kind !== undefined) { fields.push('kind = ?'); values.push(patch.kind); }

  const hasFields = fields.length > 0;
  if (!hasFields && holderIds === undefined) return;
  const stamp = authorshipStamp(userId);
  fields.push('updated_at = ?', 'last_edited_by = ?', 'last_edited_at = ?');
  values.push(now(), stamp.last_edited_by, stamp.last_edited_at, id);
  const sql = `UPDATE assets SET ${fields.join(', ')} WHERE id = ?`;

  if (holderIds === undefined) {
    await db.execute(sql, values);
    return;
  }
  await db.writeTransaction(async tx => {
    const row = await tx.getOptional<{ household_id: string }>(
      `SELECT household_id FROM assets WHERE id = ?`,
      [id],
    );
    if (!row) return;
    if (hasFields) await tx.execute(sql, values);
    await setHolders(tx, {
      householdId: row.household_id,
      subjectType: 'asset',
      subjectId: id,
      memberIds: holderIds,
      userId,
    });
  });
}

/**
 * Soft delete. The asset's holder rows are kept: every read joins active
 * assets only, so they simply stop counting.
 */
export async function softDeleteAsset(id: string, userId: string): Promise<void> {
  const stamp = authorshipStamp(userId);
  const ts = now();
  await db.execute(
    `UPDATE assets SET deleted_at = ?, updated_at = ?, last_edited_by = ?, last_edited_at = ? WHERE id = ?`,
    [ts, ts, stamp.last_edited_by, stamp.last_edited_at, id],
  );
}

// ---------------------------------------------------------------------------
// Value history
// ---------------------------------------------------------------------------

export interface AssetValuationPayload {
  /** Integer in `currency` */
  value: number;
  currency: AssetCurrency;
  /** YYYY-MM-DD: the day this value was known (may be in the past). */
  valued_on: string;
  note?: string | null;
}

interface ValuationRow {
  householdId: string;
  assetId: string;
  value: number;
  currency: string;
  valuedOn: string;
  note: string | null;
  createdBy: string;
  createdAt: string;
}

async function writeValuationRow(exec: Executor, id: string, row: ValuationRow): Promise<void> {
  await exec.execute(
    `INSERT INTO asset_valuations
       (id, household_id, asset_id, value, currency, valued_on, note, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, row.householdId, row.assetId, row.value, row.currency, row.valuedOn, row.note, row.createdBy, row.createdAt],
  );
}

/** Sets the asset's value and currency to its latest active valuation. */
async function syncCurrentValue(exec: Executor, assetId: string, userId: string): Promise<void> {
  const latest = await exec.getOptional<{ value: number; currency: string }>(
    `SELECT value, currency FROM asset_valuations
     WHERE asset_id = ? AND deleted_at IS NULL
     ORDER BY valued_on DESC, created_at DESC LIMIT 1`,
    [assetId],
  );
  if (!latest) return;
  const stamp = authorshipStamp(userId);
  await exec.execute(
    `UPDATE assets SET value = ?, currency = ?, updated_at = ?, last_edited_by = ?, last_edited_at = ? WHERE id = ?`,
    [latest.value, latest.currency, now(), stamp.last_edited_by, stamp.last_edited_at, assetId],
  );
}

/**
 * Records a new value of the asset and updates its current value, in ONE
 * transaction. An asset without valuations (created before the history
 * existed, or by an older client) first gets one with the value it had, so
 * that value is not lost. Returns the new valuation id, or null when the
 * asset no longer exists.
 */
export async function addAssetValuation(
  assetId: string,
  payload: AssetValuationPayload,
  userId: string,
): Promise<string | null> {
  const id = newId();
  let written = false;
  await db.writeTransaction(async tx => {
    const asset = await tx.getOptional<{ household_id: string; value: number; currency: string; created_at: string }>(
      `SELECT household_id, value, currency, created_at FROM assets WHERE id = ?`,
      [assetId],
    );
    if (!asset) return;
    assertAuth(asset.household_id, userId);

    const { n } = (await tx.getOptional<{ n: number }>(
      `SELECT COUNT(*) AS n FROM asset_valuations WHERE asset_id = ? AND deleted_at IS NULL`,
      [assetId],
    )) ?? { n: 0 };
    const seedId = initialValuationId(assetId);
    const seeded = !!(await tx.getOptional(`SELECT id FROM asset_valuations WHERE id = ?`, [seedId]));
    if (n === 0 && !seeded) {
      await writeValuationRow(tx, seedId, {
        householdId: asset.household_id,
        assetId,
        value: asset.value,
        currency: asset.currency,
        valuedOn: asset.created_at.slice(0, 10),
        note: null,
        createdBy: userId,
        createdAt: asset.created_at,
      });
    }

    await writeValuationRow(tx, id, {
      householdId: asset.household_id,
      assetId,
      value: payload.value,
      currency: payload.currency,
      valuedOn: payload.valued_on,
      note: payload.note?.trim() || null,
      createdBy: userId,
      createdAt: now(),
    });
    await syncCurrentValue(tx, assetId, userId);
    written = true;
  });
  return written ? id : null;
}

/**
 * Soft deletes a valuation written by mistake and recomputes the asset's
 * current value. The last valuation an asset has cannot be deleted.
 */
export async function deleteAssetValuation(id: string, userId: string): Promise<void> {
  await db.writeTransaction(async tx => {
    const valuation = await tx.getOptional<{ asset_id: string }>(
      `SELECT asset_id FROM asset_valuations WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    if (!valuation) return;
    const { n } = (await tx.getOptional<{ n: number }>(
      `SELECT COUNT(*) AS n FROM asset_valuations WHERE asset_id = ? AND deleted_at IS NULL`,
      [valuation.asset_id],
    )) ?? { n: 0 };
    if (n <= 1) throw new Error('[PowerSyncAssetRepository] Cannot delete the last valuation of an asset');

    await tx.execute(`UPDATE asset_valuations SET deleted_at = ? WHERE id = ?`, [now(), id]);
    await syncCurrentValue(tx, valuation.asset_id, userId);
  });
}
