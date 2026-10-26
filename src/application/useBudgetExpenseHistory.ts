import { useMemo } from 'react';
import { useExpensesForBudget, type BudgetExpenseRow } from '@/infrastructure/powersync/queries';
import { getCurrentMonth } from '@/shared/helpers';
import { paginateByMonth, initialPageIndex, type MonthGroup } from '@/domain/expense/expenseHistory';

const PAGE_SIZE = 20;

/** One page of a partida's history: consecutive whole months, oldest first. */
export type BudgetHistoryPage = MonthGroup<BudgetExpenseRow>[];

/** A partida's expenses in pages of whole months, and the page to open on (the current month's). */
export function useBudgetExpenseHistory(budgetId: string) {
  const { data: rows = [], isLoading } = useExpensesForBudget(budgetId);
  const currentMonth = getCurrentMonth();

  return useMemo(() => {
    const pages = paginateByMonth(rows, PAGE_SIZE);
    return { pages, initialPage: initialPageIndex(pages, currentMonth), currentMonth, isLoading };
  }, [rows, currentMonth, isLoading]);
}
