/**
 * useDashboardData — application service hook for the main dashboard.
 *
 * Replaces the former useBudgetBaseData + useMonthlyData hooks.
 * All SQL lives in infrastructure/powersync/queries/.
 * All financial calculations live here, not in components.
 */
import { useMemo } from 'react';
import { useBudgetsQuery, useBudgetMonthsForMonths } from '@/infrastructure/powersync/queries/useBudgetQueries';
import { useExpenseSumsForMonths } from '@/infrastructure/powersync/queries/useExpenseQueries';
import { useActiveIncomes, useIncomeMonthsForMonths } from '@/infrastructure/powersync/queries/useIncomeQueries';
import { useExchangeRatesForMonths } from '@/infrastructure/powersync/queries/useExchangeRateQueries';

// ---------------------------------------------------------------------------
// Helpers (private)
// ---------------------------------------------------------------------------

function prevNMonthsFrom(n: number, fromMonth: string): string[] {
  const [y, m] = fromMonth.split('-').map(Number);
  const months: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const t = new Date(y, m - 1 - i, 1);
    months.push(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface MonthlyDataPoint {
  month: string;
  /** Display label (short month name) — populated by the feature-layer adapter. */
  label: string;
  available: number;
  budgeted: number;
  spent: number;
  balance: number;
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
        if (currency === 'COP') available += amount;
        else if (trm) available += Math.round(amount * trm);
      }

      // Cash budgets only (credit card is not a cash outflow)
      let budgeted = 0, spent = 0;
      for (const b of budgets) {
        if (b.paid_with_credit_card === 1) continue;
        if (b.start_month > month) continue;
        if (b.end_month && b.end_month < month) continue;
        const bmKey = `${b.id}|${month}`;
        const bmRow = bmIdMap.get(bmKey);
        const amount = budgetAmountMap.get(bmKey) ?? b.default_amount;
        budgeted += amount;
        if (bmRow) spent += expenseByBmId.get(bmRow.id) ?? 0;
      }

      const balance = available - budgeted;
      const pending = Math.max(0, budgeted - spent);

      return { month, label: month, available, budgeted, spent, balance, pending };
    });
  }, [last6, budgets, incomes, budgetAmountMap, bmIdMap, expenseByBmId, imMap, trmMap]);

  return { monthlyData, currentMonth: selectedMonth, last6, budgets, bmIdMap, expenseByBmId, budgetAmountMap };
}
