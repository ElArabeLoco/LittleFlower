import { useMemo, useCallback } from 'react';
import { toCOPWithMissing } from '@/shared/helpers';
import { useBudgetsQuery, useBudgetMonthsForMonth } from '@/infrastructure/powersync/queries/useBudgetQueries';
import { useExpenseSumsByModeForMonth } from '@/infrastructure/powersync/queries/useExpenseQueries';
import { useIncomesForMonth, useIncomeMonthsForMonth } from '@/infrastructure/powersync/queries/useIncomeQueries';
import { useExchangeRateForMonth } from '@/infrastructure/powersync/queries/useExchangeRateQueries';
import type { BudgetRow, BudgetMonthRow, IncomeRow, IncomeMonthRow } from '@/infrastructure/powersync/queries/types';
import { cashEnvelope } from './cashEnvelope';

export type { BudgetRow, BudgetMonthRow, IncomeRow, IncomeMonthRow };

export interface GroupTotals {
  budgeted: number;
  spent: number;
}

export interface MonthViewData {
  /** All active budgets (credit card + cash + dual). */
  budgets: BudgetRow[];
  /** Budgets active in this month, split by payment type (dual appears in both). */
  creditCardBudgets: BudgetRow[];
  cashBudgets: BudgetRow[];
  /** Lookup: `${budget_id}|${month}` → BudgetMonthRow. */
  bmMap: Map<string, BudgetMonthRow>;
  /** Lookup: budget_month_id → total expenses (all modes combined). */
  expenseMap: Map<string, number>;
  /** Lookup: budget_month_id → CC expenses only. */
  ccExpenseMap: Map<string, number>;
  /** Lookup: budget_month_id → cash expenses only. */
  cashExpenseMap: Map<string, number>;
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
  /** Cash envelope totals (see cashEnvelope): budgeted cash, executed cash. */
  cashTotals: GroupTotals;
  /** Every cash-paid expense of the month ("Balance real" = available − this). */
  cashRealSpent: number;
}

/**
 * All data required to render MonthViewPage for a given month.
 * SQL lives in infrastructure queries; calculations live here.
 *
 * Dual-mode budgets (payment_mode='both') appear in BOTH creditCardBudgets and
 * cashBudgets. Their planned amount only counts toward CC totals; the Cash group
 * shows their cash-only executed amount with budgeted=0.
 */
export function useMonthViewData(month: string): MonthViewData {
  const { data: budgets = [] } = useBudgetsQuery();
  const { data: budgetMonths = [] } = useBudgetMonthsForMonth(month);
  const { data: expenseSumsByMode = [] } = useExpenseSumsByModeForMonth(month);
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

  // Dual-mode budgets appear in BOTH groups
  const creditCardBudgets = useMemo(
    () => activeForMonth.filter(b => b.payment_mode === 'credit_card' || b.payment_mode === 'both'),
    [activeForMonth],
  );

  const cashBudgets = useMemo(
    () => activeForMonth.filter(b => b.payment_mode === 'cash' || b.payment_mode === 'both'),
    [activeForMonth],
  );

  // incomes is already filtered by month in SQL (useIncomesForMonth)
  const activeIncomes = incomes;

  const { totalAvailable, hasMissingTrm } = useMemo(() => {
    let total = 0;
    let missing = false;
    for (const inc of activeIncomes) {
      const im = imMap.get(inc.id);
      const amount = im ? im.real_amount : inc.default_amount;
      const currency = im ? im.currency : inc.currency;
      const { value, missingTrm } = toCOPWithMissing(amount, currency, trm);
      total += value;
      if (missingTrm) missing = true;
  }
  return { totalAvailable: total, hasMissingTrm: missing };
  }, [activeIncomes, imMap, trm]);

  // Group totals — dual budgets: planned amount only in CC, cash section gets 0 budgeted
  const calcGroupTotals = useCallback(
    (group: BudgetRow[], isCC: boolean): GroupTotals => {
      let budgeted = 0, spent = 0;
      const modeMap = isCC ? ccExpenseMap : cashExpenseMap;
      for (const b of group) {
        const bm = bmMap.get(`${b.id}|${month}`);
        if (isCC || b.payment_mode !== 'both') {
          budgeted += bm?.amount ?? b.default_amount;
        }
        spent += bm ? (modeMap.get(bm.id) ?? 0) : 0;
      }
      return { budgeted, spent };
    },
    [bmMap, ccExpenseMap, cashExpenseMap, month],
  );

  const ccTotals = useMemo(() => calcGroupTotals(creditCardBudgets, true), [creditCardBudgets, calcGroupTotals]);
  // Shared with the dashboard and Home so the three screens show the same figures.
  const cashEnvelopeTotals = useMemo(() => {
    const budgetMonthByBudgetId = new Map<string, BudgetMonthRow>();
    for (const b of cashBudgets) {
      const bm = bmMap.get(`${b.id}|${month}`);
      if (bm) budgetMonthByBudgetId.set(b.id, bm);
    }
    return cashEnvelope({ budgets: cashBudgets, budgetMonthByBudgetId, cashSpentByBudgetMonthId: cashExpenseMap });
  }, [cashBudgets, bmMap, cashExpenseMap, month]);
  const cashTotals = useMemo<GroupTotals>(
    () => ({ budgeted: cashEnvelopeTotals.budgeted, spent: cashEnvelopeTotals.executed }),
    [cashEnvelopeTotals],
  );

  return {
    budgets,
    creditCardBudgets,
    cashBudgets,
    bmMap,
    expenseMap,
    ccExpenseMap,
    cashExpenseMap,
    activeIncomes,
    imMap,
    trm,
    totalAvailable,
    hasMissingTrm,
    ccTotals,
    cashTotals,
    cashRealSpent: cashEnvelopeTotals.realSpent,
  };
}
