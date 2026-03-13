import { useQuery } from '@powersync/react';
import type { HouseholdRow, UserRow } from './types';

/** Household info for a given id. Returns null if the id is empty. */
export function useHouseholdQuery(householdId: string) {
  return useQuery<HouseholdRow>(
    householdId
      ? `SELECT id, name, join_code FROM households WHERE id = ? LIMIT 1`
      : `SELECT id, name, join_code FROM households WHERE 1=0`,
    householdId ? [householdId] : [],
  );
}

/** Single user by id (for settings profile card). Returns null if id is empty. */
export function useUserQuery(userId: string) {
  return useQuery<UserRow>(
    userId
      ? `SELECT id, name, color FROM users WHERE id = ? LIMIT 1`
      : `SELECT id, name, color FROM users WHERE 1=0`,
    userId ? [userId] : [],
  );
}
