/**
 * Shared internal helpers for all PowerSync mutation functions.
 * Used by repository files — not exported outside infrastructure/.
 */

import type { LockContext } from '@powersync/web';

/** Reads and writes on the database or inside an open write transaction. */
export type Executor = Pick<LockContext, 'execute' | 'getAll' | 'getOptional'>;

export function newId(): string {
  return crypto.randomUUID();
}

export function now(): string {
  return new Date().toISOString();
}

export function authorshipStamp(userId: string): { last_edited_by: string; last_edited_at: string } {
  return {
    last_edited_by: userId,
    last_edited_at: now(),
  };
}

/** Guard: throws if household_id or userId are empty strings (session not ready). */
export function assertAuth(householdId: string, userId: string): void {
  if (!householdId || !userId) {
    throw new Error(
      `[mutationHelpers] Attempted write with empty auth: household_id="${householdId}" userId="${userId}". ` +
      `This usually means the mutation was called before the session was ready.`,
    );
  }
}
