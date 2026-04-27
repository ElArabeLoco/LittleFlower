import { useCallback } from 'react';
import {
  insertDebt as insertDebtMW,
  updateDebt as updateDebtMW,
  softDeleteDebt as softDeleteDebtMW,
  insertDebtTransaction as insertDebtTransactionMW,
  softDeleteDebtTransaction as softDeleteDebtTransactionMW,
  type InsertDebtPayload,
  type InsertDebtTransactionPayload,
} from '@/infrastructure/powersync/mutationWrappers';

export type { InsertDebtPayload, InsertDebtTransactionPayload };

export function useDebtMutations(householdId: string, userId: string) {
  const insertDebt = useCallback(
    async (payload: Omit<InsertDebtPayload, 'household_id' | 'created_by'>) => {
      return insertDebtMW(
        { ...payload, household_id: householdId, created_by: userId },
        userId,
      );
    },
    [householdId, userId],
  );

  const updateDebt = useCallback(
    async (id: string, patch: Parameters<typeof updateDebtMW>[1]) => {
      return updateDebtMW(id, patch, userId);
    },
    [userId],
  );

  const softDeleteDebt = useCallback(
    async (id: string) => {
      return softDeleteDebtMW(id, userId);
    },
    [userId],
  );

  const insertDebtTransaction = useCallback(
    async (payload: Omit<InsertDebtTransactionPayload, 'household_id'>) => {
      return insertDebtTransactionMW({ ...payload, household_id: householdId }, userId);
    },
    [householdId, userId],
  );

  const softDeleteDebtTransaction = useCallback(
    async (id: string) => {
      return softDeleteDebtTransactionMW(id);
    },
    [],
  );

  return {
    insertDebt,
    updateDebt,
    softDeleteDebt,
    insertDebtTransaction,
    softDeleteDebtTransaction,
  };
}
