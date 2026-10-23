/**
 * useHomeData — everything the Home page shows for the current month.
 *
 * Reuses useMonthViewData so the balance matches the month view exactly, and
 * adds what the section tiles summarize (incomes, debts, recent expenses).
 */

import { useMemo } from 'react';
import { useUserQuery } from '@/infrastructure/powersync/queries/useHouseholdQueries';
import { useRecentExpenses, type RecentExpenseRow } from '@/infrastructure/powersync/queries/useExpenseQueries';
import { useMonthViewData } from './useMonthViewData';
import { useDebtManagementSummary } from './useDebtSummary';
import { listMonthBudgets, summarizeMonthBalance, type MonthBalance, type MonthBudgets } from './homeSummary';

export type { RecentExpenseRow };

const RECENT_EXPENSES_LIMIT = 5;

export interface HomeData {
  /** Display name of the signed-in person, once synced. */
  userName: string | null;
  balance: MonthBalance;
  budgets: MonthBudgets;
  trm: number | null;
  /** A foreign-currency income has no TRM for the month, so it is left out. */
  hasMissingTrm: boolean;
  incomeCount: number;
  hasForeignIncome: boolean;
  debtBalance: number;
  activeDebtCount: number;
  recentExpenses: RecentExpenseRow[];
}

export function useHomeData(month: string, userId: string): HomeData {
  const {
    creditCardBudgets,
    cashBudgets,
    bmMap,
    cashExpenseMap,
    activeIncomes,
    trm,
    totalAvailable,
    hasMissingTrm,
    cashTotals,
  } = useMonthViewData(month);
  const { data: users = [] } = useUserQuery(userId);
  const { totalBalance, activeDebts } = useDebtManagementSummary();
  const { data: recentExpenses = [] } = useRecentExpenses(month, RECENT_EXPENSES_LIMIT);

  const balance = useMemo(() => {
    let realSpent = 0;
    for (const spent of cashExpenseMap.values()) realSpent += spent;
    return summarizeMonthBalance({
      available: totalAvailable,
      budgeted: cashTotals.budgeted,
      executed: cashTotals.spent,
      realSpent,
    });
  }, [cashExpenseMap, totalAvailable, cashTotals]);

  const budgets = useMemo(
    () => listMonthBudgets(creditCardBudgets, cashBudgets, bmMap, month),
    [creditCardBudgets, cashBudgets, bmMap, month],
  );

  return {
    userName: users[0]?.name?.trim() || null,
    balance,
    budgets,
    trm,
    hasMissingTrm,
    incomeCount: activeIncomes.length,
    hasForeignIncome: activeIncomes.some(income => income.currency !== 'COP'),
    debtBalance: totalBalance,
    activeDebtCount: activeDebts.length,
    recentExpenses,
  };
}
