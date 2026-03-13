import { useQuery } from '@powersync/react';
import type { BudgetRow, BudgetMonthRow } from './types';

/** All active budgets ordered by payment type then name. */
export function useBudgetsQuery() {
  return useQuery<BudgetRow>(
    `SELECT id, name, description, category_id, paid_with_credit_card,
            default_amount, household_id, start_month, end_month, debt_id
     FROM budgets WHERE deleted_at IS NULL ORDER BY paid_with_credit_card DESC, name ASC`,
  );
}

/** Budget months for a single month (includes id for mutations). */
export function useBudgetMonthsForMonth(month: string) {
  return useQuery<BudgetMonthRow>(
    `SELECT id, budget_id, month, amount, is_executed FROM budget_months WHERE month = ?`,
    [month],
  );
}

/** Budget months for multiple months (e.g. last N months for dashboard). */
export function useBudgetMonthsForMonths(months: string[]) {
  return useQuery<BudgetMonthRow>(
    months.length > 0
      ? `SELECT id, budget_id, month, amount, is_executed
         FROM budget_months WHERE month IN (${months.map(() => '?').join(',')})`
      : `SELECT id, budget_id, month, amount, is_executed FROM budget_months WHERE 1=0`,
    months,
  );
}

/** Budget months for a calendar year range (YearView). */
export function useBudgetMonthsForRange(fromMonth: string, toMonth: string) {
  return useQuery<BudgetMonthRow>(
    `SELECT id, budget_id, month, amount, is_executed
     FROM budget_months WHERE month >= ? AND month <= ?`,
    [fromMonth, toMonth],
  );
}

/** Projected row returned by the AppShell joined query. */
export interface BudgetWithExpenseTotalsRow {
  id: string;
  name: string;
  category_id: string;
  paid_with_credit_card: number;
  default_amount: number;
  bm_id: string | null;
  bm_amount: number | null;
  bm_is_executed: number | null;
  total_expenses: number;
}

/**
 * Budgets joined with their budget_month and total expenses for a given month.
 * Used by AppShell to render the budget table without additional queries.
 */
export function useBudgetWithExpenseTotals(month: string) {
  return useQuery<BudgetWithExpenseTotalsRow>(
    `SELECT
       b.id,
       b.name,
       b.category_id,
       b.paid_with_credit_card,
       b.default_amount,
       bm.id          AS bm_id,
       bm.amount      AS bm_amount,
       bm.is_executed AS bm_is_executed,
       COALESCE((
         SELECT SUM(e.amount) FROM expenses e
         WHERE e.budget_month_id = bm.id AND e.deleted_at IS NULL
       ), 0) AS total_expenses
     FROM budgets b
     LEFT JOIN budget_months bm ON bm.budget_id = b.id AND bm.month = ?
     WHERE b.deleted_at IS NULL
     ORDER BY b.paid_with_credit_card DESC, b.name ASC`,
    [month],
  );
}

/** Returns true when at least one budget exists (used by EmptyState). */
export function useHasBudgets() {
  return useQuery<{ id: string }>(
    `SELECT id FROM budgets WHERE deleted_at IS NULL LIMIT 1`,
  );
}

/** Effective budget target amount for a named budget in a given month. */
export function useBudgetTargetByName(month: string, budgetName: string, householdId: string) {
  return useQuery<{ amount: number }>(
    `SELECT COALESCE(bm.amount, b.default_amount) as amount
     FROM budgets b
     LEFT JOIN budget_months bm ON bm.budget_id = b.id AND bm.month = ?
     WHERE b.name = ? AND b.household_id = ?
     LIMIT 1`,
    [month, budgetName, householdId],
  );
}

/** Total effective target for all credit-card budgets in a given month. */
export function useCreditCardBudgetTarget(month: string, householdId: string) {
  return useQuery<{ total: number }>(
    `SELECT SUM(COALESCE(bm.amount, b.default_amount)) as total
     FROM budgets b
     LEFT JOIN budget_months bm ON bm.budget_id = b.id AND bm.month = ?
     WHERE b.paid_with_credit_card = 1 AND b.household_id = ?`,
    [month, householdId],
  );
}
