import { useCallback } from 'react';
import { nextMemberTone, toMemberTone, type MemberTone } from '@/domain/member/HouseholdMember';
import {
  insertMember as insertMemberMW,
  updateMember as updateMemberMW,
  softDeleteMember as softDeleteMemberMW,
} from '@/infrastructure/powersync/mutationWrappers';
import { useHouseholdMembersQuery } from '@/infrastructure/powersync/queries/useMemberQueries';

export function useMemberMutations(householdId: string, userId: string) {
  const { data: memberRows = [] } = useHouseholdMembersQuery();

  /** Creates a member; the tone defaults to the first one nobody uses. */
  const createMember = useCallback(
    async (name: string, tone?: MemberTone) => {
      const chosen = tone ?? nextMemberTone(memberRows.map(row => toMemberTone(row.tone)));
      return insertMemberMW(
        { household_id: householdId, name, tone: chosen, created_by: userId },
        userId,
      );
    },
    [householdId, userId, memberRows],
  );

  const updateMember = useCallback(
    async (id: string, patch: { name?: string; tone?: MemberTone }) => {
      return updateMemberMW(id, patch, userId);
    },
    [userId],
  );

  const deleteMember = useCallback(
    async (id: string) => {
      return softDeleteMemberMW(id, userId);
    },
    [userId],
  );

  return { createMember, updateMember, deleteMember };
}
