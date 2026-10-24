/**
 * PowerSyncAssetRepository — writes assets and their holders.
 *
 * Reads go through the reactive hooks in queries/useAssetQueries.ts.
 */

import { db } from '../client';
import { newId, now, authorshipStamp, assertAuth, type Executor } from '../mutationHelpers';
import { setHolders } from './PowerSyncMemberRepository';
import type { AssetCurrency, AssetKind } from '@/domain/asset/Asset';

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
 * Writes the asset and its holders (`holderIds`, empty = the whole household)
 * in ONE transaction.
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
 * `holderIds` (optional): the complete list of holders after the update.
 * `undefined` leaves holders untouched, `[]` removes them all. When given,
 * the asset update and the holders are written in ONE transaction — and the
 * holders apply even when `patch` has no fields.
 */
export async function updateAsset(
  id: string,
  patch: Partial<Pick<InsertAssetPayload, 'name' | 'kind' | 'value' | 'currency'>>,
  userId: string,
  holderIds?: string[],
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.name !== undefined) { fields.push('name = ?'); values.push(patch.name.trim()); }
  if (patch.kind !== undefined) { fields.push('kind = ?'); values.push(patch.kind); }
  if (patch.value !== undefined) { fields.push('value = ?'); values.push(patch.value); }
  if (patch.currency !== undefined) { fields.push('currency = ?'); values.push(patch.currency); }

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
