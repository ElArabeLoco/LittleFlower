/**
 * useExpenseHistoryData — reactive expense total (COP) for a named budget
 * over the last N months.
 *
 * Used by ExpenseHistoryChart; follows the same pattern as useIncomeHistoryData.
 */
import { useMemo } from 'react';
import { prevNMonthsFrom } from '@/shared/helpers';
import { useMonthlyExpensesByBudgetName } from '@/infrastructure/powersync/queries/useExpenseQueries';

export interface ExpenseDataPoint {
  month: string;
  spent: number;
}

export function useExpenseHistoryData(
  budgetName: string,
  n: number,
  currentMonth: string,
  householdId: string,
): ExpenseDataPoint[] {
  const months = useMemo(() => prevNMonthsFrom(n, currentMonth), [n, currentMonth]);

  const { data: rows = [] } = useMonthlyExpensesByBudgetName(months, budgetName, householdId);

  const totalsByMonth = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.month, r.total);
    return m;
  }, [rows]);

  return useMemo(
    () => months.map(month => ({ month, spent: totalsByMonth.get(month) ?? 0 })),
    [months, totalsByMonth],
  );
}
