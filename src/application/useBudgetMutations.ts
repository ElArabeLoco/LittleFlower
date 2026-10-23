import { useCallback } from 'react';
import {
  insertBudget as insertBudgetMW,
  updateBudget as updateBudgetMW,
  deleteBudget as deleteBudgetMW,
  upsertBudgetMonth as upsertBudgetMonthMW,
  updateBudgetMonthExecution as updateBudgetMonthExecutionMW,
  registerFullPaymentAndExecute as registerFullPaymentAndExecuteMW,
  applyBudgetMonthAmountForward as applyBudgetMonthAmountForwardMW,
  planDebtBackfill,
  applyDebtBackfill as applyDebtBackfillMW,
  type InsertBudgetPayload,
  type UpsertBudgetMonthPayload,
  type RegisterFullPaymentPayload,
  type ApplyForwardPayload,
} from '@/infrastructure/powersync/mutationWrappers';
import { summarizeBackfill, type BackfillSummary } from '@/domain/debt/backfill';

export type { InsertBudgetPayload, UpsertBudgetMonthPayload, RegisterFullPaymentPayload, ApplyForwardPayload, BackfillSummary };

export function useBudgetMutations(householdId: string, userId: string) {
  const insertBudget = useCallback(
    async (payload: Omit<InsertBudgetPayload, 'household_id' | 'created_by'>) => {
      return insertBudgetMW(
        { ...payload, household_id: householdId, created_by: userId },
        userId,
      );
    },
    [householdId, userId],
  );

  const updateBudget = useCallback(
    async (id: string, patch: Parameters<typeof updateBudgetMW>[1]) => {
      return updateBudgetMW(id, patch, userId);
    },
    [userId],
  );

  const deleteBudget = useCallback(
    async (id: string) => {
      return deleteBudgetMW(id, userId);
    },
    [userId],
  );

  const upsertBudgetMonth = useCallback(
    async (payload: Omit<UpsertBudgetMonthPayload, 'household_id'>) => {
      return upsertBudgetMonthMW({ ...payload, household_id: householdId }, userId);
    },
    [householdId, userId],
  );

  const updateBudgetMonthExecution = useCallback(
    async (budgetMonthId: string, isExecuted: boolean) => {
      return updateBudgetMonthExecutionMW(budgetMonthId, isExecuted, userId);
    },
    [userId],
  );

  const registerFullPaymentAndExecute = useCallback(
    async (params: Omit<RegisterFullPaymentPayload, 'householdId' | 'userId'>) => {
      return registerFullPaymentAndExecuteMW({ ...params, householdId, userId });
    },
    [householdId, userId],
  );

  const applyBudgetMonthAmountForward = useCallback(
    async (params: Omit<ApplyForwardPayload, 'householdId' | 'userId'>) => {
      return applyBudgetMonthAmountForwardMW({ ...params, householdId, userId });
    },
    [householdId, userId],
  );

  /** Past payments of a budget that linking it to `debtId` would record on the debt. */
  const previewDebtBackfill = useCallback(
    async (budgetId: string, debtId: string): Promise<BackfillSummary> => {
      return summarizeBackfill(await planDebtBackfill(budgetId, debtId));
    },
    [],
  );

  const applyDebtBackfill = useCallback(
    async (budgetId: string, debtId: string) => {
      return applyDebtBackfillMW(householdId, budgetId, debtId, userId);
    },
    [householdId, userId],
  );

  return {
    insertBudget,
    updateBudget,
    deleteBudget,
    upsertBudgetMonth,
    updateBudgetMonthExecution,
    registerFullPaymentAndExecute,
    applyBudgetMonthAmountForward,
    previewDebtBackfill,
    applyDebtBackfill,
  };
}
