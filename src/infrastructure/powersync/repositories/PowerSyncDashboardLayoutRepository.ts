/**
 * PowerSyncDashboardLayoutRepository — writes the user's dashboard layout.
 *
 * Reads go through the reactive hook in queries/useDashboardLayoutQueries.ts.
 * One row per user; the row id is the user id.
 */

import { db } from '../client';
import { now, authorshipStamp, assertAuth } from '../mutationHelpers';

export interface SaveDashboardLayoutPayload {
  household_id: string;
  /** Serialized with serializeLayout(). */
  layout: string;
}

/** Creates or replaces the user's layout. Existence is checked explicitly: rowsAffected is unreliable on PowerSync views. */
export async function saveDashboardLayout(payload: SaveDashboardLayoutPayload, userId: string): Promise<string> {
  assertAuth(payload.household_id, userId);
  const stamp = authorshipStamp(userId);
  const ts = now();

  await db.writeTransaction(async tx => {
    const existing = await tx.getOptional<{ id: string }>(`SELECT id FROM dashboard_layouts WHERE id = ?`, [userId]);
    if (existing) {
      await tx.execute(
        `UPDATE dashboard_layouts
         SET layout = ?, updated_at = ?, last_edited_by = ?, last_edited_at = ?
         WHERE id = ?`,
        [payload.layout, ts, stamp.last_edited_by, stamp.last_edited_at, userId],
      );
      return;
    }
    await tx.execute(
      `INSERT INTO dashboard_layouts
         (id, household_id, user_id, layout, created_at, updated_at, last_edited_by, last_edited_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, payload.household_id, userId, payload.layout, ts, ts, stamp.last_edited_by, stamp.last_edited_at],
    );
  });
  return userId;
}
