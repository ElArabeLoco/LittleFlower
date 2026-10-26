import { useMemo } from 'react';
import { useBudgetsQuery, useBudgetExpenseSpansQuery } from '@/infrastructure/powersync/queries';
import { getCurrentMonth } from '@/shared/helpers';
import { isFinished, type ExpenseSpan } from '@/domain/budget/budgetLifecycle';

interface LifecycleBudget {
  name: string;
  payment_mode: string;
  end_month: string | null;
}

/** Active budgets by payment group (dual budgets in both) and finished ones in one list. */
export function splitBudgetsByLifecycle<T extends LifecycleBudget>(budgets: T[], currentMonth: string) {
  const active = budgets.filter(b => !isFinished(b.end_month, currentMonth));
  const finished = budgets
    .filter(b => isFinished(b.end_month, currentMonth))
    .sort((a, b) => (b.end_month ?? '').localeCompare(a.end_month ?? '') || a.name.localeCompare(b.name));
  return {
    creditCard: active.filter(b => b.payment_mode === 'credit_card' || b.payment_mode === 'both'),
    cash: active.filter(b => b.payment_mode === 'cash' || b.payment_mode === 'both'),
    finished,
  };
}

/** Partidas page: active budgets by group, finished ones, expense span per budget. */
export function useBudgetManagementData() {
  const { data: budgets = [] } = useBudgetsQuery();
  const { data: spanRows = [] } = useBudgetExpenseSpansQuery();
  const currentMonth = getCurrentMonth();

  return useMemo(() => {
    const expenseSpans = new Map<string, ExpenseSpan>(
      spanRows.map(r => [r.budget_id, { first: r.first_month, last: r.last_month }]),
    );
    return { ...splitBudgetsByLifecycle(budgets, currentMonth), expenseSpans, hasBudgets: budgets.length > 0 };
  }, [budgets, spanRows, currentMonth]);
}
