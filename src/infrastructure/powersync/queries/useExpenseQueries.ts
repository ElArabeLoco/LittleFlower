import { useQuery } from '@powersync/react';

/** Expense list row for the expense form dialog. */
export interface ExpenseListRow {
  id: string;
  amount: number;
  note: string | null;
  timestamp: string;
}

/**
 * Reactive expense list for a specific budget_month.
 * Returns an empty result when budgetMonthId is null (no BM created yet).
 */
export function useExpensesForBudgetMonth(budgetMonthId: string | null) {
  return useQuery<ExpenseListRow>(
    budgetMonthId
      ? `SELECT id, amount, note, timestamp
         FROM expenses
         WHERE budget_month_id = ? AND deleted_at IS NULL
         ORDER BY timestamp DESC, created_at DESC`
      : `SELECT id, amount, note, timestamp FROM expenses WHERE 1=0`,
    budgetMonthId ? [budgetMonthId] : [],
  );
}

/** Aggregated expense totals per budget_month for a single month. */
export interface ExpenseSumRow {
  budget_month_id: string;
  total: number;
}

export function useExpenseSumsForMonth(month: string) {
  return useQuery<ExpenseSumRow>(
    `SELECT e.budget_month_id, SUM(e.amount) as total
     FROM expenses e
     JOIN budget_months bm ON bm.id = e.budget_month_id
     WHERE bm.month = ? AND e.deleted_at IS NULL
     GROUP BY e.budget_month_id`,
    [month],
  );
}

/** Aggregated expense totals per budget_month for multiple months (dashboard). */
export interface ExpenseSumWithMonthRow extends ExpenseSumRow {
  month: string;
}

export function useExpenseSumsForMonths(months: string[]) {
  return useQuery<ExpenseSumWithMonthRow>(
    months.length > 0
      ? `SELECT e.budget_month_id, bm.month, SUM(e.amount) as total
         FROM expenses e
         JOIN budget_months bm ON bm.id = e.budget_month_id
         WHERE bm.month IN (${months.map(() => '?').join(',')}) AND e.deleted_at IS NULL
         GROUP BY e.budget_month_id, bm.month`
      : `SELECT budget_month_id, month, total FROM budget_months WHERE 1=0`,
    months,
  );
}

/** Aggregated expense totals per budget_month for a calendar year range. */
export function useExpenseSumsForRange(fromMonth: string, toMonth: string) {
  return useQuery<ExpenseSumRow>(
    `SELECT e.budget_month_id, SUM(e.amount) as total
     FROM expenses e
     JOIN budget_months bm ON bm.id = e.budget_month_id
     WHERE bm.month >= ? AND bm.month <= ? AND e.deleted_at IS NULL
     GROUP BY e.budget_month_id`,
    [fromMonth, toMonth],
  );
}

/** Recent expense feed row (joined with budget name and category). */
export interface RecentExpenseRow {
  id: string;
  amount: number;
  note: string | null;
  timestamp: string;
  budget_name: string;
  category_id: string;
}

/** Latest N positive expenses for the given month (for the dashboard feed). */
export function useRecentExpenses(month: string, limit = 10) {
  return useQuery<RecentExpenseRow>(
    `SELECT e.id, e.amount, e.note, e.timestamp, b.name as budget_name, b.category_id
     FROM expenses e
     JOIN budgets b ON b.id = e.budget_id
     JOIN budget_months bm ON bm.id = e.budget_month_id
     WHERE e.deleted_at IS NULL AND e.amount > 0 AND bm.month = ?
     ORDER BY e.timestamp DESC, e.created_at DESC
     LIMIT ?`,
    [month, limit],
  );
}

/** Daily expense row used by burn-up and daily spend charts. */
export interface DailyExpenseRow {
  day: string; // 'YYYY-MM-DD'
  total: number;
}

/** Daily spending for a specific category in a month (DailySpendChart). */
export function useDailyExpensesByCategory(month: string, categoryId: string) {
  return useQuery<DailyExpenseRow>(
    `SELECT substr(e.timestamp, 1, 10) as day, SUM(e.amount) as total
     FROM expenses e
     JOIN budget_months bm ON bm.id = e.budget_month_id
     JOIN budgets b ON b.id = bm.budget_id
     WHERE bm.month = ? AND b.category_id = ? AND e.deleted_at IS NULL AND e.amount > 0
     GROUP BY substr(e.timestamp, 1, 10)
     ORDER BY day ASC`,
    [month, categoryId],
  );
}

/** Daily spending for a named budget in a month (BudgetBurnUpChart). */
export function useDailyExpensesByBudgetName(month: string, budgetName: string, householdId: string) {
  return useQuery<DailyExpenseRow>(
    `SELECT substr(e.timestamp, 1, 10) as day, SUM(e.amount) as total
     FROM expenses e
     JOIN budget_months bm ON bm.id = e.budget_month_id
     JOIN budgets b ON b.id = bm.budget_id
     WHERE bm.month = ? AND b.name = ? AND b.household_id = ?
       AND e.deleted_at IS NULL AND e.amount > 0
     GROUP BY substr(e.timestamp, 1, 10)
     ORDER BY day ASC`,
    [month, budgetName, householdId],
  );
}

/** Daily spending for all credit-card budgets in a month (CreditCardBurnUpChart). */
export function useDailyExpensesByCreditCard(month: string, householdId: string) {
  return useQuery<DailyExpenseRow>(
    `SELECT substr(e.timestamp, 1, 10) as day, SUM(e.amount) as total
     FROM expenses e
     JOIN budget_months bm ON bm.id = e.budget_month_id
     JOIN budgets b ON b.id = bm.budget_id
     WHERE bm.month = ? AND b.paid_with_credit_card = 1 AND b.household_id = ?
       AND e.deleted_at IS NULL AND e.amount > 0
     GROUP BY substr(e.timestamp, 1, 10)
     ORDER BY day ASC`,
    [month, householdId],
  );
}
