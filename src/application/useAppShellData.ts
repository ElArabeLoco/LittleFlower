import { useMemo } from 'react';
import { toCOP } from '@/shared/helpers';
import {
  useBudgetWithExpenseTotals,
  type BudgetWithExpenseTotalsRow,
} from '@/infrastructure/powersync/queries/useBudgetQueries';
import { useExchangeRateForMonth } from '@/infrastructure/powersync/queries/useExchangeRateQueries';
import { useIncomeMonthAmountsForMonth } from '@/infrastructure/powersync/queries/useIncomeQueries';
import { useExpenseSumsByModeForMonth } from '@/infrastructure/powersync/queries/useExpenseQueries';

export interface AppShellMetrics {
  creditCardRows: BudgetWithExpenseTotalsRow[];
  cashRows: BudgetWithExpenseTotalsRow[];
  availableIncome: number;
  /** Combined budgeted total across all groups (dual counted once, on the CC side). */
  totalBudgeted: number;
  totalExecuted: number;
  /** Budgeted total for the credit-card group (includes dual budgets). */
  ccBudgeted: number;
  /** Budgeted total for the cash group (dual budgets excluded — they belong to CC). */
  cashBudgeted: number;
  /** Executed total for the credit-card group (CC expenses only, split by payment mode). */
  ccExecuted: number;
  /** Executed total for the cash group (cash expenses only, split by payment mode). */
  cashExecuted: number;
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
  const { data: expenseSumsByMode = [] } = useExpenseSumsByModeForMonth(month);

  const trm = rateRows[0]?.rate ?? null;

  // Expense totals split by payment mode, keyed by budget_month_id.
  // Mirrors useMonthViewData: CC group counts only paid_with_credit_card=1,
  // cash group counts only paid_with_credit_card=0 (so dual budgets don't
  // double-count their expenses across both groups).
  const { ccExpenseMap, cashExpenseMap } = useMemo(() => {
    const cc = new Map<string, number>();
    const cash = new Map<string, number>();
    for (const es of expenseSumsByMode) {
      const target = es.paid_with_credit_card === 1 ? cc : cash;
      target.set(es.budget_month_id, (target.get(es.budget_month_id) ?? 0) + es.total);
    }
    return { ccExpenseMap: cc, cashExpenseMap: cash };
  }, [expenseSumsByMode]);

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

  // Group totals — dual budgets (payment_mode='both') belong to the CC envelope:
  // their planned amount counts toward ccBudgeted only; cashBudgeted skips them.
  const ccBudgeted = useMemo(
    () => creditCardRows.reduce((s, r) => s + (r.bm_amount ?? r.default_amount), 0),
    [creditCardRows],
  );

  const cashBudgeted = useMemo(
    () => cashRows.reduce(
      (s, r) => s + (r.payment_mode === 'both' ? 0 : (r.bm_amount ?? r.default_amount)),
      0,
    ),
    [cashRows],
  );

  // Group executed totals are split by payment mode (CC expenses in ccExecuted,
  // cash expenses in cashExecuted) so dual budgets don't double-count.
  const ccExecuted = useMemo(
    () => creditCardRows.reduce(
      (s, r) => s + (r.bm_id ? (ccExpenseMap.get(r.bm_id) ?? 0) : 0),
      0,
    ),
    [creditCardRows, ccExpenseMap],
  );

  const cashExecuted = useMemo(
    () => cashRows.reduce(
      (s, r) => s + (r.bm_id ? (cashExpenseMap.get(r.bm_id) ?? 0) : 0),
      0,
    ),
    [cashRows, cashExpenseMap],
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
    ccBudgeted,
    cashBudgeted,
    ccExecuted,
    cashExecuted,
    budgetedBalance,
    realBalance,
    trm,
    missingTrm,
  };
}
