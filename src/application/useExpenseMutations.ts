import { useCallback } from 'react';
import {
  recordExpense as recordExpenseMW,
  softDeleteExpense as softDeleteExpenseMW,
  type RecordExpensePayload,
} from '@/infrastructure/powersync/mutationWrappers';

export type { RecordExpensePayload };

export function useExpenseMutations(userId: string) {
  const recordExpense = useCallback(
    async (payload: Omit<RecordExpensePayload, 'recorded_by'>) => {
      return recordExpenseMW({ ...payload, recorded_by: userId });
    },
    [userId],
  );

  const softDeleteExpense = useCallback(
    async (expenseId: string) => {
      return softDeleteExpenseMW(expenseId);
    },
    [],
  );

  return { recordExpense, softDeleteExpense };
}