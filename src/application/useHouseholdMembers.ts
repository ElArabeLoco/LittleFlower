import { useMemo } from 'react';
import { toMemberTone, type MemberRef } from '@/domain/member/HouseholdMember';
import {
  useHouseholdMembersQuery,
  useMemberHoldingCountsQuery,
} from '@/infrastructure/powersync/queries/useMemberQueries';

export interface MemberHoldingCounts {
  incomes: number;
  debts: number;
}

export interface HouseholdMembersData {
  /** Active members, alphabetical. */
  members: MemberRef[];
  /** How many active incomes and debts each member holds (by member id). */
  countsByMember: Map<string, MemberHoldingCounts>;
  hasMembers: boolean;
}

/** The household's active members and how many incomes / debts each holds. */
export function useHouseholdMembers(): HouseholdMembersData {
  const { data: memberRows = [] } = useHouseholdMembersQuery();
  const { data: countRows = [] } = useMemberHoldingCountsQuery();

  return useMemo(() => {
    const members = memberRows.map(row => ({
      id: row.id,
      name: row.name,
      tone: toMemberTone(row.tone),
    }));

    const countsByMember = new Map<string, MemberHoldingCounts>();
    for (const row of countRows) {
      const counts = countsByMember.get(row.member_id) ?? { incomes: 0, debts: 0 };
      if (row.subject_type === 'income') counts.incomes += row.n;
      if (row.subject_type === 'debt') counts.debts += row.n;
      countsByMember.set(row.member_id, counts);
    }

    return { members, countsByMember, hasMembers: members.length > 0 };
  }, [memberRows, countRows]);
}
