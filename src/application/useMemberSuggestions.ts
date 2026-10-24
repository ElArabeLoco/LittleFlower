import { useMemo } from 'react';
import { isDuplicateMemberName } from '@/domain/member/HouseholdMember';
import {
  useHouseholdMembersQuery,
  useHouseholdUsersQuery,
} from '@/infrastructure/powersync/queries/useMemberQueries';

/**
 * Account names that no active member uses yet, deduped (case and accents
 * ignored). Offered as one-tap member suggestions in the empty state.
 */
export function useMemberSuggestions(): string[] {
  const { data: users = [] } = useHouseholdUsersQuery();
  const { data: members = [] } = useHouseholdMembersQuery();

  return useMemo(() => {
    const taken = members.map(member => member.name);
    const suggestions: string[] = [];
    for (const user of users) {
      const name = user.name?.trim();
      if (!name) continue;
      if (isDuplicateMemberName(name, [...taken, ...suggestions])) continue;
      suggestions.push(name);
    }
    return suggestions;
  }, [users, members]);
}
