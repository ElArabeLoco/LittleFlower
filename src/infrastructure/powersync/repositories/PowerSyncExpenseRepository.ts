/**
 * PowerSyncExpenseRepository — implements IExpenseRepository using PowerSync.
 *
 * Expenses are an append-only ledger. There are no updates — only new records.
 * Negative amounts represent reversals of previous records.
 * Net spend = SUM(amount) across all active records for a budgetMonthId.
 */

import { db } from '../client';
import type { IExpenseRepository } from '@/domain/expense/IExpenseRepository';
import type { Expense } from '@/domain/expense/Expense';

// ---------------------------------------------------------------------------
// Raw row shape
// ---------------------------------------------------------------------------

interface ExpenseRow {
  id: string;
  household_id: string;
  budget_id: string;
  budget_month_id: string;
  amount: number;
  note: string | null;
  recorded_by: string;
  timestamp: string;
  created_at: string;
  linked_expense_id: string | null;
  deleted_at: string | null;
  paid_with_credit_card: number; // 0 | 1
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    householdId: row.household_id,
    budgetId: row.budget_id,
    budgetMonthId: row.budget_month_id,
    amount: row.amount,
    note: row.note,
    recordedBy: row.recorded_by,
    timestamp: row.timestamp,
    createdAt: row.created_at,
    linkedExpenseId: row.linked_expense_id,
    deletedAt: row.deleted_at,
    paidWithCreditCard: row.paid_with_credit_card === 1,
  };
}

// ---------------------------------------------------------------------------
// Repository implementation
// ---------------------------------------------------------------------------

export class PowerSyncExpenseRepository implements IExpenseRepository {
  /**
   * All non-deleted expense records for a given month.
   * Includes both positive (expense) and negative (reversal) records.
   * Net spend = SUM(amount) on the result set.
   */
  async listActiveByMonth(month: string): Promise<Expense[]> {
    const rows = await db.getAll<ExpenseRow>(
      `SELECT e.*
       FROM expenses e
       INNER JOIN budget_months bm ON bm.id = e.budget_month_id
       WHERE bm.month = ?
         AND e.deleted_at IS NULL
       ORDER BY e.timestamp DESC`,
      [month],
    );
    return rows.map(toExpense);
  }

  /**
   * All non-deleted expense records for a specific BudgetMonth.
   * Used to compute the net spend of a single budget line item.
   */
  async listByBudgetMonth(budgetMonthId: string): Promise<Expense[]> {
    const rows = await db.getAll<ExpenseRow>(
      `SELECT * FROM expenses
       WHERE budget_month_id = ? AND deleted_at IS NULL
       ORDER BY timestamp DESC`,
      [budgetMonthId],
    );
    return rows.map(toExpense);
  }
}
