/**
 * useDashboardData — application service hook for the main dashboard.
 *
 * Replaces the former useBudgetBaseData + useMonthlyData hooks.
 * All SQL lives in infrastructure/powersync/queries/.
 * All financial calculations live here, not in components.
 */
import { useMemo } from 'react';
import { toCOP, prevNMonthsFrom } from '@/shared/helpers';
import { useBudgetsQuery, useBudgetMonthsForMonths } from '@/infrastructure/powersync/queries/useBudgetQueries';
import { useExpenseSumsForMonths, useExpenseSumsByModeForRange } from '@/infrastructure/powersync/queries/useExpenseQueries';
import { useActiveIncomes, useIncomeMonthsForMonths } from '@/infrastructure/powersync/queries/useIncomeQueries';
import { useExchangeRatesForMonths } from '@/infrastructure/powersync/queries/useExchangeRateQueries';
import { cashEnvelope } from './cashEnvelope';


// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface MonthlyDataPoint {
  month: string;
  /** Display label (short month name) — populated by the feature-layer adapter. */
  label: string;
  available: number;
  /** Cash envelope, as in the month view (see cashEnvelope). */
  budgeted: number;
  spent: number;
  /** Balance ideal: available − budgeted. */
  balance: number;
  /** Balance real: available − every cash-paid expense of the month. */
  realBalance: number;
  pending: number;
}

import type { BudgetRow } from '@/infrastructure/powersync/queries/types';
export type { BudgetRow };

export interface DashboardData {
  monthlyData: MonthlyDataPoint[];
  currentMonth: string;
  last6: string[];
  /** All active budgets (used by chart components for category/payment-type lookups). */
  budgets: BudgetRow[];
  /** Lookup: `${budgetId}|${month}` → BudgetMonthRow */
  bmIdMap: Map<string, { id: string; budget_id: string; month: string; amount: number; is_executed: number }>;
  /** Lookup: budget_month_id → total expenses */
  expenseByBmId: Map<string, number>;
  /** Lookup: `${budgetId}|${month}` → overridden amount */
  budgetAmountMap: Map<string, number>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Reactive dashboard data: 6 months ending at selectedMonth of budget/income/expense aggregates.
 * Returns both pre-computed MonthlyDataPoint[] and raw lookup maps for charts.
 */
export function useDashboardData(selectedMonth: string): DashboardData {
  const last6 = useMemo(() => prevNMonthsFrom(6, selectedMonth), [selectedMonth]);

  const { data: budgets = [] } = useBudgetsQuery();
  const { data: budgetMonths = [] } = useBudgetMonthsForMonths(last6);
  const { data: expenseSums = [] } = useExpenseSumsForMonths(last6);
  // last6 is ascending, so its ends bound the range.
  const { data: expenseSumsByMode = [] } = useExpenseSumsByModeForRange(last6[0], last6[last6.length - 1]);
  const { data: incomes = [] } = useActiveIncomes();
  const { data: incomeMonths = [] } = useIncomeMonthsForMonths(last6);
  const { data: exchangeRates = [] } = useExchangeRatesForMonths(last6);

  // Build lookup maps once per data change

  const bmIdMap = useMemo(() => {
    const m = new Map<string, { id: string; budget_id: string; month: string; amount: number; is_executed: number }>();
    for (const bm of budgetMonths) m.set(`${bm.budget_id}|${bm.month}`, bm);
    return m;
  }, [budgetMonths]);

  const expenseByBmId = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenseSums) m.set(e.budget_month_id, (m.get(e.budget_month_id) ?? 0) + e.total);
    return m;
  }, [expenseSums]);

  const budgetAmountMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const bm of budgetMonths) m.set(`${bm.budget_id}|${bm.month}`, bm.amount);
    return m;
  }, [budgetMonths]);

  /** month → (budget_month_id → cash-paid total) */
  const cashSpentByMonth = useMemo(() => {
    const byMonth = new Map<string, Map<string, number>>();
    for (const row of expenseSumsByMode) {
      if (row.paid_with_credit_card === 1) continue;
      const forMonth = byMonth.get(row.month) ?? new Map<string, number>();
      forMonth.set(row.budget_month_id, (forMonth.get(row.budget_month_id) ?? 0) + row.total);
      byMonth.set(row.month, forMonth);
    }
    return byMonth;
  }, [expenseSumsByMode]);

  const imMap = useMemo(() => {
    const m = new Map<string, { income_id: string; month: string; real_amount: number; currency: string }>();
    for (const im of incomeMonths) m.set(`${im.income_id}|${im.month}`, im);
    return m;
  }, [incomeMonths]);

  const trmMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const er of exchangeRates) m.set(er.month, er.rate);
    return m;
  }, [exchangeRates]);

  // Compute monthly data points (the financial calculations)
  const monthlyData: MonthlyDataPoint[] = useMemo(() => {
    return last6.map(month => {
      const trm = trmMap.get(month) ?? null;

      // Available income: sum all active income sources converted to COP
      let available = 0;
      for (const inc of incomes) {
        if (inc.start_month > month) continue;
        if (inc.end_month != null && inc.end_month < month) continue;
        const im = imMap.get(`${inc.id}|${month}`);
        const amount = im ? im.real_amount : inc.default_amount;
        const currency = im ? im.currency : inc.currency;
        available += toCOP(amount, currency, trm);
      }

      // Same cash envelope as the month view and Home, so the three screens agree.
      const activeBudgets = budgets.filter(
        b => b.start_month <= month && (b.end_month == null || b.end_month >= month),
      );
      const budgetMonthByBudgetId = new Map<string, { id: string; amount: number }>();
      for (const b of activeBudgets) {
        const bmRow = bmIdMap.get(`${b.id}|${month}`);
        if (bmRow) budgetMonthByBudgetId.set(b.id, bmRow);
      }
      const { budgeted, executed: spent, realSpent } = cashEnvelope({
        budgets: activeBudgets,
        budgetMonthByBudgetId,
        cashSpentByBudgetMonthId: cashSpentByMonth.get(month) ?? new Map(),
      });

      const balance = available - budgeted;
      const realBalance = available - realSpent;
      const pending = Math.max(0, budgeted - spent);

      return { month, label: month, available, budgeted, spent, balance, realBalance, pending };
    });
  }, [last6, budgets, incomes, bmIdMap, cashSpentByMonth, imMap, trmMap]);

  return useMemo(() => ({
    monthlyData,
    currentMonth: selectedMonth,
    last6,
    budgets,
    bmIdMap,
    expenseByBmId,
    budgetAmountMap,
  }), [monthlyData, selectedMonth, last6, budgets, bmIdMap, expenseByBmId, budgetAmountMap]);
}
