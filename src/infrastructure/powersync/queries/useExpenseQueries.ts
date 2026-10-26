import { useQuery } from '@powersync/react';

/** Expense list row for the expense form dialog. */
export interface ExpenseListRow {
  id: string;
  amount: number;
  note: string | null;
  timestamp: string;
  paid_with_credit_card: number; // 0 | 1
}

/**
 * Reactive expense list for a specific budget_month.
 * Returns an empty result when budgetMonthId is null (no BM created yet).
 */
export function useExpensesForBudgetMonth(budgetMonthId: string | null) {
  return useQuery<ExpenseListRow>(
    budgetMonthId
      ? `SELECT id, amount, note, timestamp, paid_with_credit_card
         FROM expenses
         WHERE budget_month_id = ? AND deleted_at IS NULL
         ORDER BY timestamp DESC, created_at DESC`
      : `SELECT id, amount, note, timestamp, paid_with_credit_card FROM expenses WHERE 1=0`,
    budgetMonthId ? [budgetMonthId] : [],
  );
}

/** Expense of a partida with its budget month (partida history). */
export interface BudgetExpenseRow extends ExpenseListRow {
  month: string;
}

/** Every non-deleted expense of a budget, oldest budget month first. */
export function useExpensesForBudget(budgetId: string) {
  return useQuery<BudgetExpenseRow>(
    `SELECT e.id, e.amount, e.note, e.timestamp, e.paid_with_credit_card, bm.month
     FROM expenses e
     JOIN budget_months bm ON bm.id = e.budget_month_id
     WHERE bm.budget_id = ? AND e.deleted_at IS NULL
     ORDER BY bm.month ASC, e.timestamp ASC, e.created_at ASC`,
    [budgetId],
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

/** Expense totals per budget_month + payment mode for a single month (used by MonthViewData). */
export interface ExpenseSumByModeRow {
  budget_month_id: string;
  paid_with_credit_card: number; // 0 | 1
  total: number;
}

export function useExpenseSumsByModeForMonth(month: string) {
  return useQuery<ExpenseSumByModeRow>(
    `SELECT e.budget_month_id, e.paid_with_credit_card, SUM(e.amount) as total
     FROM expenses e
     JOIN budget_months bm ON bm.id = e.budget_month_id
     WHERE bm.month = ? AND e.deleted_at IS NULL
     GROUP BY e.budget_month_id, e.paid_with_credit_card`,
    [month],
  );
}

/** Expense totals per budget_month + payment mode for a year range (used by YearViewData). */
export interface ExpenseSumByModeWithMonthRow extends ExpenseSumByModeRow {
  month: string;
}

export function useExpenseSumsByModeForRange(fromMonth: string, toMonth: string) {
  return useQuery<ExpenseSumByModeWithMonthRow>(
    `SELECT e.budget_month_id, bm.month, e.paid_with_credit_card, SUM(e.amount) as total
     FROM expenses e
     JOIN budget_months bm ON bm.id = e.budget_month_id
     WHERE bm.month >= ? AND bm.month <= ? AND e.deleted_at IS NULL
     GROUP BY e.budget_month_id, bm.month, e.paid_with_credit_card`,
    [fromMonth, toMonth],
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
  paid_with_credit_card: number; // 0 | 1
}

/** Latest N positive expenses for the given month (for the dashboard feed). */
export function useRecentExpenses(month: string, limit = 10) {
  return useQuery<RecentExpenseRow>(
    `SELECT e.id, e.amount, e.note, e.timestamp, b.name as budget_name, b.category_id,
            e.paid_with_credit_card
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

/** Daily spending for all credit-card expenses in a month (CreditCardBurnUpChart). */
export function useDailyExpensesByCreditCard(month: string, householdId: string) {
  return useQuery<DailyExpenseRow>(
    `SELECT substr(e.timestamp, 1, 10) as day, SUM(e.amount) as total
     FROM expenses e
     JOIN budget_months bm ON bm.id = e.budget_month_id
     JOIN budgets b ON b.id = bm.budget_id
     WHERE bm.month = ? AND e.paid_with_credit_card = 1 AND b.household_id = ?
       AND e.deleted_at IS NULL AND e.amount > 0
     GROUP BY substr(e.timestamp, 1, 10)
     ORDER BY day ASC`,
    [month, householdId],
  );
}

/** Full transaction row for the transactions ledger page. */
export interface TransactionRow {
  id: string;
  amount: number;
  note: string | null;
  timestamp: string;
  paid_with_credit_card: number; // 0 | 1
  budget_name: string;
  category_id: string;
}

/** All non-deleted expenses for a month with budget name and category (for TransactionsPage). */
export function useTransactionsForMonth(month: string) {
  return useQuery<TransactionRow>(
    `SELECT e.id, e.amount, e.note, e.timestamp, e.paid_with_credit_card,
            b.name as budget_name, b.category_id
     FROM expenses e
     JOIN budget_months bm ON bm.id = e.budget_month_id
     JOIN budgets b ON b.id = e.budget_id
     WHERE bm.month = ? AND e.deleted_at IS NULL
     ORDER BY e.timestamp ASC, e.created_at ASC`,
    [month],
  );
}

/** Daily spending for all cash expenses in a month (CashBurnUpChart). */
export function useDailyExpensesByCash(month: string, householdId: string) {
  return useQuery<DailyExpenseRow>(
    `SELECT substr(e.timestamp, 1, 10) as day, SUM(e.amount) as total
     FROM expenses e
     JOIN budget_months bm ON bm.id = e.budget_month_id
     JOIN budgets b ON b.id = bm.budget_id
     WHERE bm.month = ? AND e.paid_with_credit_card = 0 AND b.household_id = ?
       AND e.deleted_at IS NULL AND e.amount > 0
     GROUP BY substr(e.timestamp, 1, 10)
     ORDER BY day ASC`,
    [month, householdId],
  );
}

/** Monthly expense total for a named budget across a range of months (ExpenseHistoryChart). */
export interface MonthlyExpenseByBudgetNameRow {
  month: string;
  total: number;
}

export function useMonthlyExpensesByBudgetName(months: string[], budgetName: string, householdId: string) {
  return useQuery<MonthlyExpenseByBudgetNameRow>(
    months.length > 0
      ? `SELECT bm.month, SUM(e.amount) as total
         FROM expenses e
         JOIN budget_months bm ON bm.id = e.budget_month_id
         JOIN budgets b ON b.id = bm.budget_id
         WHERE bm.month IN (${months.map(() => '?').join(',')})
           AND b.name = ? AND b.household_id = ?
           AND e.deleted_at IS NULL AND e.amount > 0
         GROUP BY bm.month
         ORDER BY bm.month`
      : `SELECT month, total FROM budget_months WHERE 1=0`,
    [...months, budgetName, householdId],
  );
}
