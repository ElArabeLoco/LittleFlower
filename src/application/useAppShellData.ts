import { useMemo } from 'react';
import { toCOP } from '@/shared/helpers';
import {
  useBudgetWithExpenseTotals,
  type BudgetWithExpenseTotalsRow,
} from '@/infrastructure/powersync/queries/useBudgetQueries';
import { useExchangeRateForMonth } from '@/infrastructure/powersync/queries/useExchangeRateQueries';
import { useIncomeMonthAmountsForMonth } from '@/infrastructure/powersync/queries/useIncomeQueries';

export interface AppShellMetrics {
  creditCardRows: BudgetWithExpenseTotalsRow[];
  cashRows: BudgetWithExpenseTotalsRow[];
  availableIncome: number;
  totalBudgeted: number;
  totalExecuted: number;
  budgetedBalance: number;
  realBalance: number;
  trm: number | null;
  /** True when there are USD incomes and no TRM is available for the month. */
  missingTrm: boolean;
}

/**
 * All data and computed metrics needed by AppShell for a given month.
 * Encapsulates the three reactive queries and the income-conversion calculation.
 */
export function useAppShellData(month: string): AppShellMetrics {
  const { data: budgetRows = [] } = useBudgetWithExpenseTotals(month);
  const { data: rateRows = [] } = useExchangeRateForMonth(month);
  const { data: incomeRows = [] } = useIncomeMonthAmountsForMonth(month);

  const trm = rateRows[0]?.rate ?? null;

  const availableIncome = useMemo(() => {
    return incomeRows.reduce((sum, row) => {
      return sum + toCOP(row.real_amount, row.currency, trm);
    }, 0);
  }, [incomeRows, trm]);

  const creditCardRows = useMemo(
    () => budgetRows.filter(r => r.payment_mode === 'credit_card' || r.payment_mode === 'both'),
    [budgetRows],
  );

  const cashRows = useMemo(
    () => budgetRows.filter(r => r.payment_mode === 'cash' || r.payment_mode === 'both'),
    [budgetRows],
  );

  const totalBudgeted = useMemo(
    () => budgetRows.reduce((s, r) => s + (r.bm_amount ?? r.default_amount), 0),
    [budgetRows],
  );

  const totalExecuted = useMemo(
    () => budgetRows.reduce((s, r) => s + r.total_expenses, 0),
    [budgetRows],
  );

  const budgetedBalance = availableIncome - totalBudgeted;
  const realBalance = availableIncome - totalExecuted;

  const missingTrm = useMemo(
    () => trm === null && incomeRows.some(r => r.currency !== 'COP'),
    [trm, incomeRows],
  );

  return {
    creditCardRows,
    cashRows,
    availableIncome,
    totalBudgeted,
    totalExecuted,
    budgetedBalance,
    realBalance,
    trm,
    missingTrm,
  };
}
