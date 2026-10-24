import { useMemo } from 'react';
import { toMemberTone, type MemberRef } from '@/domain/member/HouseholdMember';
import type { HoldableType } from '@/domain/member/holders';
import { useHoldersQuery } from '@/infrastructure/powersync/queries/useMemberQueries';

/**
 * Active holders of every income (or debt), keyed by income / debt id.
 * A subject without an entry belongs to the whole household.
 */
export function useHoldersBySubject(type: HoldableType): Map<string, MemberRef[]> {
  const { data: rows = [] } = useHoldersQuery(type);

  return useMemo(() => {
    const bySubject = new Map<string, MemberRef[]>();
    for (const row of rows) {
      const holders = bySubject.get(row.subject_id) ?? [];
      holders.push({ id: row.member_id, name: row.name, tone: toMemberTone(row.tone) });
      bySubject.set(row.subject_id, holders);
    }
    return bySubject;
  }, [rows]);
}
