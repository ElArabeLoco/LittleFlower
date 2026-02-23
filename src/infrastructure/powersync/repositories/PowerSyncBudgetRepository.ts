/**
 * PowerSyncBudgetRepository — implements IBudgetRepository using PowerSync.
 *
 * All queries run against the local SQLite database (WASM). PowerSync keeps
 * it in sync with Supabase Postgres in the background.
 *
 * Snake_case ↔ camelCase mapping happens in the private mapper functions.
 */

import { db } from '../client';
import type { IBudgetRepository } from '@/domain/budget/IBudgetRepository';
import type { Budget, BudgetMonth } from '@/domain/budget/Budget';

// ---------------------------------------------------------------------------
// Raw row shapes (as returned by SQLite)
// ---------------------------------------------------------------------------

interface BudgetRow {
  id: string;
  household_id: string;
  name: string;
  description: string | null;
  category_id: string;
  start_month: string;
  default_amount: number;
  paid_with_credit_card: number; // 0 | 1
  credit_card_id: string | null;
  debt_id: string | null;
  created_by: string;
  created_at: string;
  deleted_at: string | null;
  last_edited_by: string | null;
  last_edited_at: string | null;
}

interface BudgetMonthRow {
  id: string;
  household_id: string;
  budget_id: string;
  month: string;
  amount: number;
  is_executed: number; // 0 | 1
  notes: string | null;
  created_at: string;
  updated_at: string;
  last_edited_by: string | null;
  last_edited_at: string | null;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function toBudget(row: BudgetRow): Budget {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    description: row.description,
    categoryId: row.category_id,
    startMonth: row.start_month,
    defaultAmount: row.default_amount,
    paidWithCreditCard: row.paid_with_credit_card === 1,
    creditCardId: row.credit_card_id,
    debtId: row.debt_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
    lastEditedBy: row.last_edited_by,
    lastEditedAt: row.last_edited_at,
  };
}

function toBudgetMonth(row: BudgetMonthRow): BudgetMonth {
  return {
    id: row.id,
    householdId: row.household_id,
    budgetId: row.budget_id,
    month: row.month,
    amount: row.amount,
    isExecuted: row.is_executed === 1,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastEditedBy: row.last_edited_by,
    lastEditedAt: row.last_edited_at,
  };
}

// ---------------------------------------------------------------------------
// Repository implementation
// ---------------------------------------------------------------------------

export class PowerSyncBudgetRepository implements IBudgetRepository {
  /** All non-deleted budgets, ordered by name. */
  async listActive(): Promise<Budget[]> {
    const rows = await db.getAll<BudgetRow>(
      `SELECT * FROM budgets WHERE deleted_at IS NULL ORDER BY name ASC`,
    );
    return rows.map(toBudget);
  }

  /** All budgets including soft-deleted (for audit purposes). */
  async listAll(): Promise<Budget[]> {
    const rows = await db.getAll<BudgetRow>(`SELECT * FROM budgets ORDER BY name ASC`);
    return rows.map(toBudget);
  }

  async getById(id: string): Promise<Budget | null> {
    const row = await db.get<BudgetRow>(`SELECT * FROM budgets WHERE id = ?`, [id]);
    return row ? toBudget(row) : null;
  }

  /**
   * Returns all BudgetMonth rows for a given month.
   * Used by MonthlyMetricsService and the month view.
   */
  async listMonthRows(month: string): Promise<BudgetMonth[]> {
    const rows = await db.getAll<BudgetMonthRow>(
      `SELECT * FROM budget_months WHERE month = ?`,
      [month],
    );
    return rows.map(toBudgetMonth);
  }

  async getMonthRow(budgetId: string, month: string): Promise<BudgetMonth | null> {
    const row = await db.get<BudgetMonthRow>(
      `SELECT * FROM budget_months WHERE budget_id = ? AND month = ?`,
      [budgetId, month],
    );
    return row ? toBudgetMonth(row) : null;
  }
}
