import { useMemo, useCallback } from 'react';
import { useBudgetsQuery, useBudgetMonthsForMonth } from '@/infrastructure/powersync/queries/useBudgetQueries';
import { useExpenseSumsForMonth } from '@/infrastructure/powersync/queries/useExpenseQueries';
import { useIncomesForMonth, useIncomeMonthsForMonth } from '@/infrastructure/powersync/queries/useIncomeQueries';
import { useExchangeRateForMonth } from '@/infrastructure/powersync/queries/useExchangeRateQueries';
import type { BudgetRow, BudgetMonthRow, IncomeRow, IncomeMonthRow } from '@/infrastructure/powersync/queries/types';

export type { BudgetRow, BudgetMonthRow, IncomeRow, IncomeMonthRow };

export interface GroupTotals {
  budgeted: number;
  spent: number;
}

export interface MonthViewData {
  /** All active budgets (credit card + cash). */
  budgets: BudgetRow[];
  /** Budgets active in this month, split by payment type. */
  creditCardBudgets: BudgetRow[];
  cashBudgets: BudgetRow[];
  /** Lookup: `${budget_id}|${month}` → BudgetMonthRow. */
  bmMap: Map<string, BudgetMonthRow>;
  /** Lookup: budget_month_id → total expenses. */
  expenseMap: Map<string, number>;
  /** Income sources active this month. */
  activeIncomes: IncomeRow[];
  /** Lookup: income_id → IncomeMonthRow override. */
  imMap: Map<string, IncomeMonthRow>;
  /** USD→COP rate for the month (null if not set). */
  trm: number | null;
  /** Total available income in COP for the month. */
  totalAvailable: number;
  /** True when USD incomes exist but no TRM is set for the month. */
  hasMissingTrm: boolean;
  /** Aggregated totals for credit card budgets. */
  ccTotals: GroupTotals;
  /** Aggregated totals for cash budgets. */
  cashTotals: GroupTotals;
}

/**
 * All data required to render MonthViewPage for a given month.
 * SQL lives in infrastructure queries; calculations live here.
 */
export function useMonthViewData(month: string): MonthViewData {
  const { data: budgets = [] } = useBudgetsQuery();
  const { data: budgetMonths = [] } = useBudgetMonthsForMonth(month);
  const { data: expenseSums = [] } = useExpenseSumsForMonth(month);
  const { data: incomes = [] } = useIncomesForMonth(month);
  const { data: incomeMonths = [] } = useIncomeMonthsForMonth(month);
  const { data: rateRows = [] } = useExchangeRateForMonth(month);

  const trm = rateRows[0]?.rate ?? null;

  // Build lookup maps
  const bmMap = useMemo(() => {
    const m = new Map<string, BudgetMonthRow>();
    for (const bm of budgetMonths) m.set(`${bm.budget_id}|${bm.month}`, bm);
    return m;
  }, [budgetMonths]);

  const expenseMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const es of expenseSums) m.set(es.budget_month_id, es.total);
    return m;
  }, [expenseSums]);

  const imMap = useMemo(() => {
    const m = new Map<string, IncomeMonthRow>();
    for (const im of incomeMonths) m.set(im.income_id, im);
    return m;
  }, [incomeMonths]);

  // Active budgets for the month
  const activeForMonth = useMemo(
    () => budgets.filter(b => b.start_month <= month && (b.end_month == null || b.end_month >= month)),
    [budgets, month],
  );

  const creditCardBudgets = useMemo(
    () => activeForMonth.filter(b => b.paid_with_credit_card === 1),
    [activeForMonth],
  );

  const cashBudgets = useMemo(
    () => activeForMonth.filter(b => b.paid_with_credit_card === 0),
    [activeForMonth],
  );

  // incomes is already filtered by month in SQL (useIncomesForMonth), so no JS filter needed
  const activeIncomes = incomes;

  // Total available income in COP
  const { totalAvailable, hasMissingTrm } = useMemo(() => {
    let total = 0;
    let missing = false;
    for (const inc of activeIncomes) {
      const im = imMap.get(inc.id);
      const amount = im ? im.real_amount : inc.default_amount;
      const currency = im ? im.currency : inc.currency;
      if (currency === 'COP') {
        total += amount;
      } else if (trm) {
        total += Math.round(amount * trm);
      } else {
        missing = true;
      }
    }
    return { totalAvailable: total, hasMissingTrm: missing };
  }, [activeIncomes, imMap, trm]);

  // Group totals
  const calcGroupTotals = useCallback(
    (group: BudgetRow[]): GroupTotals => {
      let budgeted = 0, spent = 0;
      for (const b of group) {
        const bm = bmMap.get(`${b.id}|${month}`);
        budgeted += bm?.amount ?? b.default_amount;
        spent += bm ? (expenseMap.get(bm.id) ?? 0) : 0;
      }
      return { budgeted, spent };
    },
    [bmMap, expenseMap, month],
  );

  const ccTotals = useMemo(() => calcGroupTotals(creditCardBudgets), [creditCardBudgets, calcGroupTotals]);
  const cashTotals = useMemo(() => calcGroupTotals(cashBudgets), [cashBudgets, calcGroupTotals]);

  return {
    budgets,
    creditCardBudgets,
    cashBudgets,
    bmMap,
    expenseMap,
    activeIncomes,
    imMap,
    trm,
    totalAvailable,
    hasMissingTrm,
    ccTotals,
    cashTotals,
  };
}
