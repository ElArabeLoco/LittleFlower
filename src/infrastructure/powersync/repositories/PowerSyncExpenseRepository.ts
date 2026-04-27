/**
 * PowerSyncExpenseRepository — implements IExpenseRepository using PowerSync.
 *
 * Expenses are an append-only ledger. There are no updates — only new records.
 * Negative amounts represent reversals of previous records.
 * Net spend = SUM(amount) across all active records for a budgetMonthId.
 */

import { db } from '../client';
import { newId, now, assertAuth } from '../mutationHelpers';
import { insertDebtTransaction } from './PowerSyncDebtRepository';
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

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

export interface RecordExpensePayload {
  household_id: string;
  budget_id: string;
  budget_month_id: string;
  amount: number;             // integer COP; negative = reversal
  note?: string;
  recorded_by: string;        // userId
  timestamp: string;          // ISO8601 — user-visible date of the expense
  paid_with_credit_card: boolean;
  linked_expense_id?: string; // set when reversing another expense
  /** If the budget is linked to a debt, pass the debt_id here to auto-create a debit transaction */
  debt_id?: string;
}

/**
 * Records a new expense. Expenses are append-only — this is the only
 * mutation allowed on the expenses table.
 *
 * To reverse an expense: call recordExpense with a negative amount and
 * linked_expense_id pointing to the original.
 */
export async function recordExpense(payload: RecordExpensePayload): Promise<string> {
  assertAuth(payload.household_id, payload.recorded_by);
  const id = newId();
  await db.execute(
    `INSERT INTO expenses
       (id, household_id, budget_id, budget_month_id, amount, note,
        recorded_by, timestamp, created_at, linked_expense_id, paid_with_credit_card)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payload.household_id,
      payload.budget_id,
      payload.budget_month_id,
      payload.amount,
      payload.note ?? null,
      payload.recorded_by,
      payload.timestamp,
      now(),
      payload.linked_expense_id ?? null,
      payload.paid_with_credit_card ? 1 : 0,
    ],
  );

  // Auto-create a debt debit transaction if this budget is linked to a debt
  if (payload.debt_id && payload.amount > 0) {
    const date = payload.timestamp.split('T')[0];
    await insertDebtTransaction(
      {
        household_id: payload.household_id,
        debt_id: payload.debt_id,
        amount: payload.amount,
        type: 'debit',
        source: 'expense',
        expense_id: id,
        date,
        note: payload.note,
      },
      payload.recorded_by,
    );
  }

  return id;
}

/** MVP soft-delete: marks the expense as deleted via deleted_at. */
export async function softDeleteExpense(id: string): Promise<void> {
  await db.execute(`UPDATE expenses SET deleted_at = ? WHERE id = ?`, [now(), id]);
}
