/**
 * PowerSyncBudgetRepository — implements IBudgetRepository using PowerSync.
 *
 * All queries run against the local SQLite database (WASM). PowerSync keeps
 * it in sync with Supabase Postgres in the background.
 *
 * Snake_case ↔ camelCase mapping happens in the private mapper functions.
 */

import { db } from '../client';
import { newId, now, authorshipStamp, assertAuth } from '../mutationHelpers';
import { buildMonthRange } from '@/shared/helpers/dateRange';
import { recordExpense } from './PowerSyncExpenseRepository';
import type { IBudgetRepository } from '@/domain/budget/IBudgetRepository';
import type { Budget, BudgetMonth, PaymentMode } from '@/domain/budget/Budget';

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
  payment_mode: string; // 'cash' | 'credit_card' | 'both'
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
    paymentMode: row.payment_mode as PaymentMode,
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

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

export interface InsertBudgetPayload {
  household_id: string;
  name: string;
  description?: string;
  category_id: string;
  start_month: string;       // 'YYYY-MM'
  end_month?: string | null; // 'YYYY-MM' | null | undefined — null/undefined = no end date
  default_amount: number;    // integer COP
  payment_mode: PaymentMode;
  credit_card_id?: string;
  /** FK to debts.id — when set, expenses auto-create a debit transaction on this debt */
  debt_id?: string | null;
  created_by: string;        // userId
}

export async function insertBudget(payload: InsertBudgetPayload, userId: string): Promise<string> {
  assertAuth(payload.household_id, userId);
  const id = newId();
  const stamp = authorshipStamp(userId);
  await db.execute(
    `INSERT INTO budgets
       (id, household_id, name, description, category_id, start_month, end_month,
        default_amount, payment_mode, credit_card_id, debt_id,
        created_by, created_at, last_edited_by, last_edited_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payload.household_id,
      payload.name,
      payload.description ?? null,
      payload.category_id,
      payload.start_month,
      payload.end_month ?? null,
      payload.default_amount,
      payload.payment_mode,
      payload.credit_card_id ?? null,
      payload.debt_id ?? null,
      payload.created_by,
      now(),
      stamp.last_edited_by,
      stamp.last_edited_at,
    ],
  );
  return id;
}

export async function updateBudget(
  id: string,
  patch: Partial<Pick<InsertBudgetPayload, 'name' | 'description' | 'default_amount' | 'category_id' | 'end_month' | 'debt_id' | 'payment_mode'>>,
  userId: string,
): Promise<void> {
  const stamp = authorshipStamp(userId);
  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.name !== undefined) { fields.push('name = ?'); values.push(patch.name); }
  if (patch.description !== undefined) { fields.push('description = ?'); values.push(patch.description); }
  if (patch.default_amount !== undefined) { fields.push('default_amount = ?'); values.push(patch.default_amount); }
  if (patch.category_id !== undefined) { fields.push('category_id = ?'); values.push(patch.category_id); }
  if (patch.payment_mode !== undefined) { fields.push('payment_mode = ?'); values.push(patch.payment_mode); }
  if ('end_month' in patch) { fields.push('end_month = ?'); values.push(patch.end_month ?? null); }
  if ('debt_id' in patch) { fields.push('debt_id = ?'); values.push(patch.debt_id ?? null); }

  fields.push('last_edited_by = ?', 'last_edited_at = ?');
  values.push(stamp.last_edited_by, stamp.last_edited_at, id);

  await db.execute(`UPDATE budgets SET ${fields.join(', ')} WHERE id = ?`, values);
}

/** Soft-delete: sets deleted_at to now. Does not remove the record. */
export async function deleteBudget(id: string, userId: string): Promise<void> {
  const stamp = authorshipStamp(userId);
  await db.execute(
    `UPDATE budgets SET deleted_at = ?, last_edited_by = ?, last_edited_at = ? WHERE id = ?`,
    [now(), stamp.last_edited_by, stamp.last_edited_at, id],
  );
}

export interface UpsertBudgetMonthPayload {
  id?: string;              // if provided → update; if omitted → insert new
  household_id: string;
  budget_id: string;
  month: string;            // 'YYYY-MM'
  amount: number;           // integer COP
  is_executed?: boolean;
  notes?: string;
}

export async function upsertBudgetMonth(
  payload: UpsertBudgetMonthPayload,
  userId: string,
): Promise<string> {
  assertAuth(payload.household_id, userId);
  // PowerSync exposes tables as views — ON CONFLICT is not supported on views,
  // and result.rowsAffected is unreliable on views. Use explicit SELECT EXISTS
  // to decide between UPDATE and INSERT.
  const stamp = authorshipStamp(userId);
  const ts = now();

  const exists =
    !!payload.id &&
    !!(await db.get<{ id: string }>(
      `SELECT id FROM budget_months WHERE id = ?`,
      [payload.id],
    ));

  if (exists) {
    await db.execute(
      `UPDATE budget_months
       SET amount = ?, is_executed = ?, notes = ?,
           updated_at = ?, last_edited_by = ?, last_edited_at = ?
       WHERE id = ?`,
      [
        payload.amount,
        payload.is_executed ? 1 : 0,
        payload.notes ?? null,
        ts,
        stamp.last_edited_by,
        stamp.last_edited_at,
        payload.id!,
      ],
    );
    return payload.id!;
  }

  const id = payload.id ?? newId();
  await db.execute(
    `INSERT INTO budget_months
       (id, household_id, budget_id, month, amount, is_executed, notes,
        created_at, updated_at, last_edited_by, last_edited_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payload.household_id,
      payload.budget_id,
      payload.month,
      payload.amount,
      payload.is_executed ? 1 : 0,
      payload.notes ?? null,
      ts,
      ts,
      stamp.last_edited_by,
      stamp.last_edited_at,
    ],
  );
  return id;
}

export async function updateBudgetMonthExecution(
  id: string,
  isExecuted: boolean,
  userId: string,
): Promise<void> {
  const stamp = authorshipStamp(userId);
  await db.execute(
    `UPDATE budget_months
     SET is_executed = ?, updated_at = ?, last_edited_by = ?, last_edited_at = ?
     WHERE id = ?`,
    [isExecuted ? 1 : 0, now(), stamp.last_edited_by, stamp.last_edited_at, id],
  );
}

export interface RegisterFullPaymentPayload {
  budgetId: string;
  /** Existing budget_month id. If null, a new row is created before recording the expense. */
  budgetMonthId: string | null;
  householdId: string;
  month: string;           // 'YYYY-MM'
  amount: number;          // full budgeted amount for the month
  spentAmount: number;     // already recorded (SUM of expenses — may be 0)
  debtId: string | null;
  userId: string;
  paidWithCreditCard: boolean;
}

/**
 * Registers an expense for the remaining unspent balance and marks the budget
 * month as executed. Creates the budget_month row if it doesn't exist yet.
 * If spentAmount >= amount there is no remaining balance — only marks executed.
 */
export async function registerFullPaymentAndExecute(
  payload: RegisterFullPaymentPayload,
): Promise<void> {
  assertAuth(payload.householdId, payload.userId);

  let bmId = payload.budgetMonthId;
  if (!bmId) {
    bmId = await upsertBudgetMonth(
      {
        household_id: payload.householdId,
        budget_id: payload.budgetId,
        month: payload.month,
        amount: payload.amount,
        is_executed: false,
      },
      payload.userId,
    );
  }

  const remaining = Math.max(0, payload.amount - payload.spentAmount);
  if (remaining > 0) {
    await recordExpense({
      household_id: payload.householdId,
      budget_id: payload.budgetId,
      budget_month_id: bmId,
      amount: remaining,
      note: 'Pago total registrado automáticamente',
      recorded_by: payload.userId,
      timestamp: new Date().toISOString(),
      paid_with_credit_card: payload.paidWithCreditCard,
      ...(payload.debtId ? { debt_id: payload.debtId } : {}),
    });
  }

  await updateBudgetMonthExecution(bmId, true, payload.userId);
}

export interface ApplyForwardPayload {
  budgetId: string;
  householdId: string;
  fromMonth: string;  // inclusive, 'YYYY-MM'
  toMonth: string;    // inclusive, 'YYYY-MM'
  amount: number;
  /**
   * All existing BudgetMonth rows for this budget within the affected range.
   * Used to skip executed months and reuse existing row ids on upsert.
   */
  existingMonths: ReadonlyArray<{ id: string; month: string; is_executed: number }>;
  userId: string;
}

/**
 * Applies a new monthly amount to all non-executed budget months in [fromMonth, toMonth].
 * Creates new budget_month rows where they don't exist yet.
 * Silently skips months where is_executed = 1.
 */
export async function applyBudgetMonthAmountForward(
  payload: ApplyForwardPayload,
): Promise<void> {
  assertAuth(payload.householdId, payload.userId);

  const months = buildMonthRange(payload.fromMonth, payload.toMonth);
  const existing = new Map(payload.existingMonths.map(m => [m.month, m]));

  for (const month of months) {
    const row = existing.get(month);
    if (row?.is_executed) continue;
    await upsertBudgetMonth(
      {
        id: row?.id,
        household_id: payload.householdId,
        budget_id: payload.budgetId,
        month,
        amount: payload.amount,
        is_executed: false,
      },
      payload.userId,
    );
  }
}
