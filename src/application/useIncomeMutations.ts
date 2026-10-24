import { useCallback } from 'react';
import {
  insertIncome as insertIncomeMW,
  updateIncome as updateIncomeMW,
  deleteIncome as deleteIncomeMW,
  upsertIncomeMonth as upsertIncomeMonthMW,
  type InsertIncomePayload,
} from '@/infrastructure/powersync/mutationWrappers';

export type { InsertIncomePayload };

export function useIncomeMutations(householdId: string, userId: string) {
  const insertIncome = useCallback(
    async (payload: Omit<InsertIncomePayload, 'household_id'>, holderIds?: string[]) => {
      return insertIncomeMW({ ...payload, household_id: householdId }, userId, holderIds);
    },
    [householdId, userId],
  );

  const updateIncome = useCallback(
    async (id: string, patch: Parameters<typeof updateIncomeMW>[1], holderIds?: string[]) => {
      return updateIncomeMW(id, patch, userId, holderIds);
    },
    [userId],
  );

  const deleteIncome = useCallback(
    async (id: string) => {
      return deleteIncomeMW(id);
    },
    [],
  );

  const upsertIncomeMonth = useCallback(
    async (payload: Omit<Parameters<typeof upsertIncomeMonthMW>[0], 'household_id'>) => {
      return upsertIncomeMonthMW({ ...payload, household_id: householdId }, userId);
    },
    [householdId, userId],
  );

  return { insertIncome, updateIncome, deleteIncome, upsertIncomeMonth };
}