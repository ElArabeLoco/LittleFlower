/**
 * PowerSyncMemberRepository — writes household members and holders.
 *
 * Reads go through the reactive hooks in queries/useMemberQueries.ts.
 *
 * A Postgres rejection blocks the upload queue forever, so these writes never
 * rely on constraints: holder ids are deterministic (a duplicate becomes the
 * same row), existence is checked explicitly before every INSERT, and a holder
 * is never written for a member that does not exist.
 */

import { db } from '../client';
import { newId, now, authorshipStamp, assertAuth, type Executor } from '../mutationHelpers';
import { diffHolders, holderId, type HoldableType } from '@/domain/member/holders';
import type { MemberTone } from '@/domain/member/HouseholdMember';

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export interface InsertMemberPayload {
  household_id: string;
  name: string;
  tone: MemberTone;
  created_by: string;
}

export async function insertMember(payload: InsertMemberPayload, userId: string): Promise<string> {
  assertAuth(payload.household_id, userId);
  const id = newId();
  const stamp = authorshipStamp(userId);
  const ts = now();
  await db.execute(
    `INSERT INTO household_members
       (id, household_id, name, tone, created_by, created_at, updated_at,
        last_edited_by, last_edited_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payload.household_id,
      payload.name.trim(),
      payload.tone,
      payload.created_by,
      ts,
      ts,
      stamp.last_edited_by,
      stamp.last_edited_at,
    ],
  );
  return id;
}

export async function updateMember(
  id: string,
  patch: Partial<Pick<InsertMemberPayload, 'name' | 'tone'>>,
  userId: string,
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.name !== undefined) { fields.push('name = ?'); values.push(patch.name.trim()); }
  if (patch.tone !== undefined) { fields.push('tone = ?'); values.push(patch.tone); }

  if (fields.length === 0) return;
  const stamp = authorshipStamp(userId);
  fields.push('updated_at = ?', 'last_edited_by = ?', 'last_edited_at = ?');
  values.push(now(), stamp.last_edited_by, stamp.last_edited_at, id);

  await db.execute(`UPDATE household_members SET ${fields.join(', ')} WHERE id = ?`, values);
}

/**
 * Soft delete. The member's holder rows are kept on purpose: every read joins
 * active members only, so they simply stop showing.
 */
export async function softDeleteMember(id: string, userId: string): Promise<void> {
  const stamp = authorshipStamp(userId);
  const ts = now();
  await db.execute(
    `UPDATE household_members
     SET deleted_at = ?, updated_at = ?, last_edited_by = ?, last_edited_at = ?
     WHERE id = ?`,
    [ts, ts, stamp.last_edited_by, stamp.last_edited_at, id],
  );
}

// ---------------------------------------------------------------------------
// Holders
// ---------------------------------------------------------------------------

export interface SetHoldersPayload {
  householdId: string;
  subjectType: HoldableType;
  subjectId: string;
  /** The complete list of holders after the write (empty = whole household). */
  memberIds: string[];
  userId: string;
}

/**
 * Makes the holders of one income / debt equal `memberIds`.
 *
 * Takes an executor so callers can run it in the same write transaction as
 * the income / debt write. Only holders of ACTIVE members are compared, so
 * rows of deleted members are never touched.
 */
export async function setHolders(exec: Executor, payload: SetHoldersPayload): Promise<void> {
  const { householdId, subjectType, subjectId, memberIds, userId } = payload;
  assertAuth(householdId, userId);

  const currentRows = await exec.getAll<{ member_id: string }>(
    `SELECT h.member_id FROM holders h
     JOIN household_members m ON m.id = h.member_id
     WHERE h.subject_type = ? AND h.subject_id = ? AND m.deleted_at IS NULL`,
    [subjectType, subjectId],
  );
  const { add, remove } = diffHolders(
    currentRows.map(row => row.member_id),
    memberIds,
  );

  for (const memberId of add) {
    const id = holderId(subjectType, subjectId, memberId);
    // PowerSync tables are views: no ON CONFLICT, rowsAffected is unreliable.
    const holderExists = !!(await exec.getOptional<{ id: string }>(
      `SELECT id FROM holders WHERE id = ?`,
      [id],
    ));
    if (holderExists) continue;
    const memberExists = !!(await exec.getOptional<{ id: string }>(
      `SELECT id FROM household_members WHERE id = ?`,
      [memberId],
    ));
    if (!memberExists) continue;
    await exec.execute(
      `INSERT INTO holders
         (id, household_id, member_id, subject_type, subject_id, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, householdId, memberId, subjectType, subjectId, userId, now()],
    );
  }

  for (const memberId of remove) {
    await exec.execute(
      `DELETE FROM holders WHERE subject_type = ? AND subject_id = ? AND member_id = ?`,
      [subjectType, subjectId, memberId],
    );
  }
}
