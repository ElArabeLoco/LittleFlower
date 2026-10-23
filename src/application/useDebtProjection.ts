import { useMemo } from 'react';
import { getCurrentMonth } from '@/shared/helpers/dateHelpers';
import { useLinkedBudgetAmountQuery } from '@/infrastructure/powersync/queries/useDebtQueries';
import { useDebtDetail, type DebtDetail } from './useDebtDetail';
import { debtPaidToDate, projectDebt, type AmortizationProjection } from './debtPlan';

export interface DebtProjection extends DebtDetail {
  projection: AmortizationProjection | null;
  /** Principal, interest and fees paid so far */
  paid: ReturnType<typeof debtPaidToDate>;
  /** Budget amount pacing a debt without amortization; null when not used */
  budgetPace: number | null;
}

/** Projection page data: remaining schedule, future totals and paid to date. */
export function useDebtProjection(debtId: string): DebtProjection {
  const detail = useDebtDetail(debtId);
  const currentMonth = getCurrentMonth();
  const { data: budgetRows = [] } = useLinkedBudgetAmountQuery(debtId, currentMonth);
  const linkedAmount = budgetRows[0]?.total ?? null;

  return useMemo(() => {
    const { debt, transactions, initialCOP, balance } = detail;
    const budgetPace = debt?.amortization === 'none' && linkedAmount ? linkedAmount : null;
    return {
      ...detail,
      projection: debt ? projectDebt(debt, initialCOP, balance, transactions, currentMonth, budgetPace) : null,
      paid: debtPaidToDate(transactions),
      budgetPace,
    };
  }, [detail, linkedAmount, currentMonth]);
}
