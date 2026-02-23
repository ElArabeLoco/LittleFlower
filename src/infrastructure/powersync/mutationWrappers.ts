/**
 * mutationWrappers — central mutation entry point for PowerSync.
 *
 * ALL writes to the local SQLite database go through these wrappers.
 * Never call db.execute() or db.writeTransaction() directly from use cases
 * or UI code.
 *
 * What these wrappers do automatically:
 *   1. Stamp `last_edited_by` and `last_edited_at` on every mutable record
 *   2. Generate UUIDs for new records (crypto.randomUUID)
 *   3. Provide a consistent, typed API for all mutations
 *   4. Serve as the single place to add Phase 2 features:
 *        - IncomeChangeLog entries on income mutations
 *        - BudgetMonthExecutionEvent on is_executed toggle
 *
 * PowerSync model:
 *   - db.execute() writes to the local SQLite first (instant, offline-safe)
 *   - PowerSync queues the change and flushes it to Supabase via uploadData()
 *     when the device is online
 *   - The connector's uploadData() translates local SQLite writes → Supabase REST
 *
 * Naming convention: snake_case column names (SQLite / PostgreSQL convention).
 */

import { db } from './client';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function newId(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function authorshipStamp(userId: string): { last_edited_by: string; last_edited_at: string } {
  return {
    last_edited_by: userId,
    last_edited_at: now(),
  };
}

// ---------------------------------------------------------------------------
// Budget mutations
// ---------------------------------------------------------------------------

export interface InsertBudgetPayload {
  household_id: string;
  name: string;
  description?: string;
  category_id: string;
  start_month: string;       // 'YYYY-MM'
  end_month?: string | null; // 'YYYY-MM' | null | undefined — null/undefined = no end date
  default_amount: number;    // integer COP
  paid_with_credit_card: boolean;
  credit_card_id?: string;
  created_by: string;        // userId
}

export async function insertBudget(payload: InsertBudgetPayload, userId: string): Promise<string> {
  const id = newId();
  const stamp = authorshipStamp(userId);
  await db.execute(
    `INSERT INTO budgets
       (id, household_id, name, description, category_id, start_month, end_month,
        default_amount, paid_with_credit_card, credit_card_id,
        created_by, created_at, last_edited_by, last_edited_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payload.household_id,
      payload.name,
      payload.description ?? null,
      payload.category_id,
      payload.start_month,
      payload.end_month ?? null,
      payload.default_amount,
      payload.paid_with_credit_card ? 1 : 0,
      payload.credit_card_id ?? null,
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
  patch: Partial<Pick<InsertBudgetPayload, 'name' | 'description' | 'default_amount' | 'category_id' | 'end_month'>>,
  userId: string,
): Promise<void> {
  const stamp = authorshipStamp(userId);
  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.name !== undefined) { fields.push('name = ?'); values.push(patch.name); }
  if (patch.description !== undefined) { fields.push('description = ?'); values.push(patch.description); }
  if (patch.default_amount !== undefined) { fields.push('default_amount = ?'); values.push(patch.default_amount); }
  if (patch.category_id !== undefined) { fields.push('category_id = ?'); values.push(patch.category_id); }
  // end_month can be set to null (clear) or a YYYY-MM string
  if ('end_month' in patch) { fields.push('end_month = ?'); values.push(patch.end_month ?? null); }

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

// ---------------------------------------------------------------------------
// BudgetMonth mutations
// ---------------------------------------------------------------------------

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
  // PowerSync exposes tables as views — ON CONFLICT is not supported on views.
  // Pattern: UPDATE first; if no rows affected, INSERT.
  const stamp = authorshipStamp(userId);
  const ts = now();

  if (payload.id) {
    // Existing row — try to UPDATE
    const result = await db.execute(
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
        payload.id,
      ],
    );
    if ((result.rowsAffected ?? 0) > 0) return payload.id;
  }

  // No existing row — INSERT
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

// ---------------------------------------------------------------------------
// Expense mutations
// ---------------------------------------------------------------------------

export interface RecordExpensePayload {
  household_id: string;
  budget_id: string;
  budget_month_id: string;
  amount: number;             // integer COP; negative = reversal
  note?: string;
  recorded_by: string;        // userId
  timestamp: string;          // ISO8601 — user-visible date of the expense
  linked_expense_id?: string; // set when reversing another expense
}

/**
 * Records a new expense. Expenses are append-only — this is the only
 * mutation allowed on the expenses table.
 *
 * To reverse an expense: call recordExpense with a negative amount and
 * linked_expense_id pointing to the original.
 */
export async function recordExpense(payload: RecordExpensePayload): Promise<string> {
  const id = newId();
  await db.execute(
    `INSERT INTO expenses
       (id, household_id, budget_id, budget_month_id, amount, note,
        recorded_by, timestamp, created_at, linked_expense_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    ],
  );
  return id;
}

/**
 * MVP soft-delete: marks the expense as deleted via deleted_at.
 * Phase 2 will replace this with a reversal record (negative amount).
 */
export async function softDeleteExpense(id: string): Promise<void> {
  await db.execute(`UPDATE expenses SET deleted_at = ? WHERE id = ?`, [now(), id]);
}

// ---------------------------------------------------------------------------
// Income mutations
// ---------------------------------------------------------------------------

export interface InsertIncomePayload {
  household_id: string;
  name: string;
  person: string;           // userId
  is_fixed: boolean;
  category: string;         // 'Salario' | 'Renta' | 'Otro'
  default_amount: number;
  currency: string;         // ISO 4217
  start_month: string;      // 'YYYY-MM'
  created_by: string;
}

export async function insertIncome(payload: InsertIncomePayload): Promise<string> {
  const id = newId();
  await db.execute(
    `INSERT INTO incomes
       (id, household_id, name, person, is_fixed, category,
        default_amount, currency, start_month, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payload.household_id,
      payload.name,
      payload.person,
      payload.is_fixed ? 1 : 0,
      payload.category,
      payload.default_amount,
      payload.currency,
      payload.start_month,
      payload.created_by,
      now(),
    ],
  );
  return id;
}

export async function updateIncome(
  id: string,
  patch: Partial<Pick<InsertIncomePayload, 'name' | 'default_amount' | 'currency' | 'is_fixed' | 'category'>>,
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.name !== undefined) { fields.push('name = ?'); values.push(patch.name); }
  if (patch.default_amount !== undefined) { fields.push('default_amount = ?'); values.push(patch.default_amount); }
  if (patch.currency !== undefined) { fields.push('currency = ?'); values.push(patch.currency); }
  if (patch.is_fixed !== undefined) { fields.push('is_fixed = ?'); values.push(patch.is_fixed ? 1 : 0); }
  if (patch.category !== undefined) { fields.push('category = ?'); values.push(patch.category); }

  if (fields.length === 0) return;
  values.push(id);
  await db.execute(`UPDATE incomes SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteIncome(id: string): Promise<void> {
  await db.execute(`UPDATE incomes SET deleted_at = ? WHERE id = ?`, [now(), id]);
}

// ---------------------------------------------------------------------------
// IncomeMonth mutations
// ---------------------------------------------------------------------------

export interface UpsertIncomeMonthPayload {
  id?: string;
  household_id: string;
  income_id: string;
  month: string;            // 'YYYY-MM'
  real_amount: number;
  currency: string;         // ISO 4217
  note?: string;
  // Salary breakdown fields (only populated when income.category = 'Salario')
  // Formula: real_amount = base_salary - deductions + round(extra_days * base_salary * 12 / 260)
  base_salary?: number;     // default 0
  deductions?: number;      // default 0
  extra_days?: number;      // default 0
}

export async function upsertIncomeMonth(
  payload: UpsertIncomeMonthPayload,
  userId: string,
): Promise<string> {
  // PowerSync exposes tables as views — ON CONFLICT is not supported on views.
  const stamp = authorshipStamp(userId);
  const ts = now();

  const baseSalary = payload.base_salary ?? 0;
  const deductions = payload.deductions ?? 0;
  const extraDays = payload.extra_days ?? 0;

  if (payload.id) {
    const result = await db.execute(
      `UPDATE income_months
       SET real_amount = ?, currency = ?, note = ?,
           base_salary = ?, deductions = ?, extra_days = ?,
           updated_at = ?, last_edited_by = ?, last_edited_at = ?
       WHERE id = ?`,
      [
        payload.real_amount,
        payload.currency,
        payload.note ?? null,
        baseSalary,
        deductions,
        extraDays,
        ts,
        stamp.last_edited_by,
        stamp.last_edited_at,
        payload.id,
      ],
    );
    if ((result.rowsAffected ?? 0) > 0) return payload.id;
  }

  const id = payload.id ?? newId();
  await db.execute(
    `INSERT INTO income_months
       (id, household_id, income_id, month, real_amount, currency, note,
        base_salary, deductions, extra_days,
        updated_at, last_edited_by, last_edited_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payload.household_id,
      payload.income_id,
      payload.month,
      payload.real_amount,
      payload.currency,
      payload.note ?? null,
      baseSalary,
      deductions,
      extraDays,
      ts,
      stamp.last_edited_by,
      stamp.last_edited_at,
    ],
  );
  return id;
}

// ---------------------------------------------------------------------------
// ExchangeRate mutations
// ---------------------------------------------------------------------------

export interface UpsertExchangeRatePayload {
  id?: string;
  household_id: string;
  from_currency: string;
  to_currency: string;
  month: string;            // 'YYYY-MM'
  rate: number;             // float
  source: 'manual' | 'fallback';
}

export async function upsertExchangeRate(
  payload: UpsertExchangeRatePayload,
  userId: string,
): Promise<string> {
  // PowerSync exposes tables as views — ON CONFLICT is not supported on views.
  const stamp = authorshipStamp(userId);
  const ts = now();

  if (payload.id) {
    const result = await db.execute(
      `UPDATE exchange_rates
       SET rate = ?, source = ?,
           updated_at = ?, last_edited_by = ?, last_edited_at = ?
       WHERE id = ?`,
      [
        payload.rate,
        payload.source,
        ts,
        stamp.last_edited_by,
        stamp.last_edited_at,
        payload.id,
      ],
    );
    if ((result.rowsAffected ?? 0) > 0) return payload.id;
  }

  const id = payload.id ?? newId();
  await db.execute(
    `INSERT INTO exchange_rates
       (id, household_id, from_currency, to_currency, month, rate, source,
        updated_at, last_edited_by, last_edited_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payload.household_id,
      payload.from_currency,
      payload.to_currency,
      payload.month,
      payload.rate,
      payload.source,
      ts,
      stamp.last_edited_by,
      stamp.last_edited_at,
    ],
  );
  return id;
}

export async function updateExchangeRate(
  id: string,
  rate: number,
  source: 'manual' | 'fallback',
  userId: string,
): Promise<void> {
  const stamp = authorshipStamp(userId);
  await db.execute(
    `UPDATE exchange_rates
     SET rate = ?, source = ?, updated_at = ?, last_edited_by = ?, last_edited_at = ?
     WHERE id = ?`,
    [rate, source, now(), stamp.last_edited_by, stamp.last_edited_at, id],
  );
}
