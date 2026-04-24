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
import type { PaymentMode } from '@/domain/budget/Budget';

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

/** Guard: throws if household_id or userId are empty strings (session not ready). */
function assertAuth(householdId: string, userId: string): void {
  if (!householdId || !userId) {
    throw new Error(
      `[mutationWrappers] Attempted write with empty auth: household_id="${householdId}" userId="${userId}". ` +
      `This usually means the mutation was called before the session was ready.`,
    );
  }
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
  // end_month can be set to null (clear) or a YYYY-MM string
  if ('end_month' in patch) { fields.push('end_month = ?'); values.push(patch.end_month ?? null); }
  // debt_id can be set to null (unlink) or a debt UUID
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
  assertAuth(payload.household_id, userId);
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
  paid_with_credit_card: boolean; // mode used for this specific transaction
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
  end_month?: string | null; // 'YYYY-MM' | null — if null, no end date
  created_by: string;
}

export async function insertIncome(payload: InsertIncomePayload): Promise<string> {
  assertAuth(payload.household_id, payload.created_by);
  const id = newId();
  await db.execute(
    `INSERT INTO incomes
       (id, household_id, name, person, is_fixed, category,
        default_amount, currency, start_month, end_month, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      payload.end_month ?? null,
      payload.created_by,
      now(),
    ],
  );
  return id;
}

export async function updateIncome(
  id: string,
  patch: Partial<Pick<InsertIncomePayload, 'name' | 'default_amount' | 'currency' | 'is_fixed' | 'category' | 'end_month'>>,
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.name !== undefined) { fields.push('name = ?'); values.push(patch.name); }
  if (patch.default_amount !== undefined) { fields.push('default_amount = ?'); values.push(patch.default_amount); }
  if (patch.currency !== undefined) { fields.push('currency = ?'); values.push(patch.currency); }
  if (patch.is_fixed !== undefined) { fields.push('is_fixed = ?'); values.push(patch.is_fixed ? 1 : 0); }
  if (patch.category !== undefined) { fields.push('category = ?'); values.push(patch.category); }
  if ('end_month' in patch) { fields.push('end_month = ?'); values.push(patch.end_month ?? null); }

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
  assertAuth(payload.household_id, userId);
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
  assertAuth(payload.household_id, userId);
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

// ---------------------------------------------------------------------------
// Debt mutations
// ---------------------------------------------------------------------------

export interface InsertDebtPayload {
  household_id: string;
  name: string;
  description?: string;
  /** Integer in the debt's own currency (COP or USD) */
  initial_amount: number;
  /** ISO 4217: 'COP' | 'USD' */
  currency: string;
  /** 'YYYY-MM-DD' */
  disbursed_at: string;
  created_by: string;
}

export async function insertDebt(payload: InsertDebtPayload, userId: string): Promise<string> {
  assertAuth(payload.household_id, userId);
  const id = newId();
  const stamp = authorshipStamp(userId);
  const ts = now();
  await db.execute(
    `INSERT INTO debts
       (id, household_id, name, description, initial_amount, currency, disbursed_at,
        created_by, created_at, updated_at, last_edited_by, last_edited_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payload.household_id,
      payload.name,
      payload.description ?? null,
      payload.initial_amount,
      payload.currency,
      payload.disbursed_at,
      payload.created_by,
      ts,
      ts,
      stamp.last_edited_by,
      stamp.last_edited_at,
    ],
  );
  return id;
}

export async function updateDebt(
  id: string,
  patch: Partial<Pick<InsertDebtPayload, 'name' | 'description' | 'initial_amount' | 'currency' | 'disbursed_at'>>,
  userId: string,
): Promise<void> {
  const stamp = authorshipStamp(userId);
  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.name !== undefined) { fields.push('name = ?'); values.push(patch.name); }
  if (patch.description !== undefined) { fields.push('description = ?'); values.push(patch.description); }
  if (patch.initial_amount !== undefined) { fields.push('initial_amount = ?'); values.push(patch.initial_amount); }
  if (patch.currency !== undefined) { fields.push('currency = ?'); values.push(patch.currency); }
  if (patch.disbursed_at !== undefined) { fields.push('disbursed_at = ?'); values.push(patch.disbursed_at); }

  if (fields.length === 0) return;
  fields.push('updated_at = ?', 'last_edited_by = ?', 'last_edited_at = ?');
  values.push(now(), stamp.last_edited_by, stamp.last_edited_at, id);

  await db.execute(`UPDATE debts SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function softDeleteDebt(id: string, userId: string): Promise<void> {
  const stamp = authorshipStamp(userId);
  await db.execute(
    `UPDATE debts SET deleted_at = ?, updated_at = ?, last_edited_by = ?, last_edited_at = ? WHERE id = ?`,
    [now(), now(), stamp.last_edited_by, stamp.last_edited_at, id],
  );
}

// ---------------------------------------------------------------------------
// DebtTransaction mutations
// ---------------------------------------------------------------------------

export interface InsertDebtTransactionPayload {
  household_id: string;
  debt_id: string;
  /** Always COP integer */
  amount: number;
  /** Amount in original currency if USD, null for COP transactions */
  original_amount?: number;
  /** 'USD' if applicable, null for COP */
  original_currency?: string;
  /** TRM used, null for COP transactions */
  exchange_rate?: number;
  type: 'debit' | 'credit';
  note?: string;
  /** 'YYYY-MM-DD' */
  date: string;
  source: 'manual' | 'expense';
  /** Set when source='expense' */
  expense_id?: string;
}

export async function insertDebtTransaction(
  payload: InsertDebtTransactionPayload,
  userId: string,
): Promise<string> {
  assertAuth(payload.household_id, userId);
  const id = newId();
  await db.execute(
    `INSERT INTO debt_transactions
       (id, household_id, debt_id, amount, original_amount, original_currency,
        exchange_rate, type, note, date, source, expense_id, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payload.household_id,
      payload.debt_id,
      payload.amount,
      payload.original_amount ?? null,
      payload.original_currency ?? null,
      payload.exchange_rate ?? null,
      payload.type,
      payload.note ?? null,
      payload.date,
      payload.source,
      payload.expense_id ?? null,
      userId,
      now(),
    ],
  );
  return id;
}

export async function softDeleteDebtTransaction(id: string): Promise<void> {
  await db.execute(`UPDATE debt_transactions SET deleted_at = ? WHERE id = ?`, [now(), id]);
}

// ---------------------------------------------------------------------------
// BudgetMonth — apply forward helpers
// ---------------------------------------------------------------------------

/**
 * Generates an array of 'YYYY-MM' strings from fromMonth to toMonth (inclusive).
 * Pure function — exported for unit testing.
 *
 * @example buildMonthRange('2025-03', '2025-06') → ['2025-03','2025-04','2025-05','2025-06']
 */
export function buildMonthRange(fromMonth: string, toMonth: string): string[] {
  const [fy, fm] = fromMonth.split('-').map(Number);
  const [ty, tm] = toMonth.split('-').map(Number);
  if (fy > ty || (fy === ty && fm > tm)) return [];
  const months: string[] = [];
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    if (++m > 12) { m = 1; y++; }
  }
  return months;
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
