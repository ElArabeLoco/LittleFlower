import { useQuery } from '@powersync/react';
import type { HoldableType } from '@/domain/member/holders';
import type {
  HolderRow,
  HouseholdUserRow,
  MemberHoldingCountRow,
  MemberHoldingRow,
  MemberRow,
} from './types';

/** Active household members, alphabetical. */
export function useHouseholdMembersQuery() {
  return useQuery<MemberRow>(
    `SELECT id, name, tone FROM household_members
     WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE`,
  );
}

/**
 * Holders of every income (or debt, or asset), joined with their ACTIVE members.
 * Holder rows of deleted members are kept in the table but never read here.
 */
export function useHoldersQuery(type: HoldableType) {
  return useQuery<HolderRow>(
    `SELECT h.subject_id, m.id AS member_id, m.name, m.tone
     FROM holders h JOIN household_members m ON m.id = h.member_id
     WHERE h.subject_type = ? AND m.deleted_at IS NULL
     ORDER BY m.name COLLATE NOCASE`,
    [type],
  );
}

/** Per member and subject type, how many active incomes / debts / assets it holds. */
export function useMemberHoldingCountsQuery() {
  return useQuery<MemberHoldingCountRow>(
    `SELECT h.member_id, h.subject_type, COUNT(*) AS n
     FROM holders h
     LEFT JOIN incomes i ON h.subject_type = 'income' AND i.id = h.subject_id
     LEFT JOIN debts d ON h.subject_type = 'debt' AND d.id = h.subject_id
     LEFT JOIN assets a ON h.subject_type = 'asset' AND a.id = h.subject_id
     WHERE (i.id IS NOT NULL AND i.deleted_at IS NULL)
        OR (d.id IS NOT NULL AND d.deleted_at IS NULL)
        OR (a.id IS NOT NULL AND a.deleted_at IS NULL)
     GROUP BY h.member_id, h.subject_type`,
  );
}

/** What one member holds (delete dialog). Empty id → no rows. */
export function useMemberHoldingsQuery(memberId: string) {
  return useQuery<MemberHoldingRow>(
    memberId
      ? `SELECT h.subject_type, h.subject_id, COALESCE(i.name, d.name, a.name) AS name
         FROM holders h
         LEFT JOIN incomes i ON h.subject_type = 'income' AND i.id = h.subject_id AND i.deleted_at IS NULL
         LEFT JOIN debts d ON h.subject_type = 'debt' AND d.id = h.subject_id AND d.deleted_at IS NULL
         LEFT JOIN assets a ON h.subject_type = 'asset' AND a.id = h.subject_id AND a.deleted_at IS NULL
         WHERE h.member_id = ? AND (i.id IS NOT NULL OR d.id IS NOT NULL OR a.id IS NOT NULL)
         ORDER BY name COLLATE NOCASE`
      : `SELECT h.subject_type, h.subject_id, '' AS name FROM holders h WHERE 1=0`,
    memberId ? [memberId] : [],
  );
}

/** Household account names, used to suggest members. */
export function useHouseholdUsersQuery() {
  return useQuery<HouseholdUserRow>(
    `SELECT id, name FROM users ORDER BY name COLLATE NOCASE`,
  );
}
