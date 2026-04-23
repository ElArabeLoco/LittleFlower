import { useMemo, useCallback } from 'react';
import { useBudgetsQuery, useBudgetMonthsForRange } from '@/infrastructure/powersync/queries/useBudgetQueries';
import { useExpenseSumsByModeForRange } from '@/infrastructure/powersync/queries/useExpenseQueries';
import { useActiveIncomes, useIncomeMonthsForRange } from '@/infrastructure/powersync/queries/useIncomeQueries';
import { useExchangeRatesForRange } from '@/infrastructure/powersync/queries/useExchangeRateQueries';
import type { BudgetRow, BudgetMonthRow } from '@/infrastructure/powersync/queries/types';

export type { BudgetRow, BudgetMonthRow };

export interface MonthMetrics {
  available: number;
  budgeted: number;
  executed: number;
  pending: number;
}

export interface YearViewData {
  budgets: BudgetRow[];
  creditCardBudgets: BudgetRow[];
  cashBudgets: BudgetRow[];
  /** Lookup: `${budgetId}|${month}` → BudgetMonthRow. */
  bmMap: Map<string, BudgetMonthRow>;
  /** Lookup: `${budget_month_id}|1` or `|0` → total by payment mode. */
  ccExpenseMap: Map<string, number>;
  cashExpenseMap: Map<string, number>;
  /** Combined expense map (all modes) — used by cells that don't need mode split. */
  expenseMap: Map<string, number>;
  /** Lookup: month → available income in COP. */
  availableMap: Map<string, number>;
  /** Lookup: month → MonthMetrics for credit-card group. */
  ccMetricsMap: Map<string, MonthMetrics>;
  /** Lookup: month → MonthMetrics for cash group. */
  cashMetricsMap: Map<string, MonthMetrics>;
}

/**
 * All data required to render YearView for a given year.
 * SQL lives in infrastructure queries; calculations live here.
 *
 * Dual-mode budgets (payment_mode='both') appear in BOTH creditCardBudgets and
 * cashBudgets. Their planned amount only counts toward the CC total; the Cash
 * group shows their cash-only executed amount with budgeted=0.
 */
export function useYearViewData(year: number, months: string[]): YearViewData {
  const fromMonth = `${year}-01`;
  const toMonth = `${year}-12`;

  const { data: budgets = [] } = useBudgetsQuery();
  const { data: budgetMonths = [] } = useBudgetMonthsForRange(fromMonth, toMonth);
  const { data: incomes = [] } = useActiveIncomes();
  const { data: incomeMonths = [] } = useIncomeMonthsForRange(fromMonth, toMonth);
  const { data: exchangeRates = [] } = useExchangeRatesForRange(fromMonth, toMonth);
  const { data: expenseSumsByMode = [] } = useExpenseSumsByModeForRange(fromMonth, toMonth);

  const bmMap = useMemo(() => {
    const m = new Map<string, BudgetMonthRow>();
    for (const bm of budgetMonths) m.set(`${bm.budget_id}|${bm.month}`, bm);
    return m;
  }, [budgetMonths]);

  // Two expense maps split by payment mode, plus a combined one
  const { ccExpenseMap, cashExpenseMap, expenseMap } = useMemo(() => {
    const cc = new Map<string, number>();
    const cash = new Map<string, number>();
    const combined = new Map<string, number>();
    for (const es of expenseSumsByMode) {
      const target = es.paid_with_credit_card === 1 ? cc : cash;
      target.set(es.budget_month_id, (target.get(es.budget_month_id) ?? 0) + es.total);
      combined.set(es.budget_month_id, (combined.get(es.budget_month_id) ?? 0) + es.total);
    }
    return { ccExpenseMap: cc, cashExpenseMap: cash, expenseMap: combined };
  }, [expenseSumsByMode]);

  const rateMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of exchangeRates) m.set(r.month, r.rate);
    return m;
  }, [exchangeRates]);

  const imMap = useMemo(() => {
    const m = new Map<string, { income_id: string; month: string; real_amount: number; currency: string }>();
    for (const im of incomeMonths) m.set(`${im.income_id}|${im.month}`, im);
    return m;
  }, [incomeMonths]);

  // Available income per month (income sources converted to COP)
  const availableMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const month of months) {
      const trm = rateMap.get(month);
      const total = incomes.reduce((sum, inc) => {
        if (inc.start_month > month) return sum;
        const im = imMap.get(`${inc.id}|${month}`);
        const amount = im ? im.real_amount : inc.default_amount;
        const currency = im ? im.currency : inc.currency;
        if (currency === 'COP') return sum + amount;
        if (trm) return sum + Math.round(amount * trm);
        return sum;
      }, 0);
      m.set(month, total);
    }
    return m;
  }, [months, incomes, imMap, rateMap]);

  // Dual-mode budgets appear in BOTH groups
  const creditCardBudgets = useMemo(
    () => budgets.filter(b => b.payment_mode === 'credit_card' || b.payment_mode === 'both'),
    [budgets],
  );

  const cashBudgets = useMemo(
    () => budgets.filter(b => b.payment_mode === 'cash' || b.payment_mode === 'both'),
    [budgets],
  );

  const calcGroupMetrics = useCallback(
    (groupBudgets: BudgetRow[], month: string, isCC: boolean): MonthMetrics => {
      let budgeted = 0, executed = 0;
      const modeMap = isCC ? ccExpenseMap : cashExpenseMap;
      for (const b of groupBudgets) {
        if (b.start_month > month) continue;
        if (b.end_month && b.end_month < month) continue;
        const bm = bmMap.get(`${b.id}|${month}`);
        // Dual budgets: planned amount only counts toward CC total. Cash group gets 0.
        if (isCC || b.payment_mode !== 'both') {
          budgeted += bm?.amount ?? b.default_amount;
        }
        if (bm) executed += modeMap.get(bm.id) ?? 0;
      }
      const pending = Math.max(0, budgeted - executed);
      return { available: availableMap.get(month) ?? 0, budgeted, executed, pending };
    },
    [bmMap, ccExpenseMap, cashExpenseMap, availableMap],
  );

  const ccMetricsMap = useMemo(
    () => new Map(months.map(m => [m, calcGroupMetrics(creditCardBudgets, m, true)])),
    [months, creditCardBudgets, calcGroupMetrics],
  );

  const cashMetricsMap = useMemo(
    () => new Map(months.map(m => [m, calcGroupMetrics(cashBudgets, m, false)])),
    [months, cashBudgets, calcGroupMetrics],
  );

  return {
    budgets,
    creditCardBudgets,
    cashBudgets,
    bmMap,
    ccExpenseMap,
    cashExpenseMap,
    expenseMap,
    availableMap,
    ccMetricsMap,
    cashMetricsMap,
  };
}
