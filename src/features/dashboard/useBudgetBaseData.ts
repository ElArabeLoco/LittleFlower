import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import { getCurrentMonth, prevNMonths } from './helpers';
import type { BudgetRow, BudgetMonthRow, BudgetMonthIdRow, ExpenseSumRow } from './types';

export function useBudgetBaseData() {
  const currentMonth = getCurrentMonth();
  const last6 = useMemo(() => prevNMonths(6), []);

  const { data: budgets = [] } = useQuery<BudgetRow>(
    `SELECT id, name, category_id, paid_with_credit_card, default_amount, start_month, end_month
     FROM budgets WHERE deleted_at IS NULL`,
  );

  const { data: budgetMonthAmounts = [] } = useQuery<BudgetMonthRow>(
    `SELECT budget_id, month, amount
     FROM budget_months
     WHERE month IN (${last6.map(() => '?').join(',')})`,
    last6,
  );

  const { data: budgetMonthIds = [] } = useQuery<BudgetMonthIdRow>(
    `SELECT id, budget_id, month, amount
     FROM budget_months
     WHERE month IN (${last6.map(() => '?').join(',')})`,
    last6,
  );

  const { data: expenseSums = [] } = useQuery<ExpenseSumRow>(
    `SELECT e.budget_month_id, bm.month, SUM(e.amount) as total
     FROM expenses e
     JOIN budget_months bm ON bm.id = e.budget_month_id
     WHERE bm.month IN (${last6.map(() => '?').join(',')}) AND e.deleted_at IS NULL
     GROUP BY e.budget_month_id, bm.month`,
    last6,
  );

  const bmIdMap = useMemo(() => {
    const m = new Map<string, BudgetMonthIdRow>();
    for (const bm of budgetMonthIds) m.set(`${bm.budget_id}|${bm.month}`, bm);
    return m;
  }, [budgetMonthIds]);

  const expenseByBmId = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenseSums) m.set(e.budget_month_id, (m.get(e.budget_month_id) ?? 0) + e.total);
    return m;
  }, [expenseSums]);

  const budgetAmountMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const bm of budgetMonthAmounts) m.set(`${bm.budget_id}|${bm.month}`, bm.amount);
    return m;
  }, [budgetMonthAmounts]);

  return { budgets, bmIdMap, expenseByBmId, budgetAmountMap, last6, currentMonth };
}
