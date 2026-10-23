/**
 * PowerSyncDebtRepository — reads and writes debts and debt_transactions.
 *
 * snake_case columns (SQLite) ↔ camelCase domain types (TypeScript).
 */

import { db } from '../client';
import { newId, now, authorshipStamp, assertAuth } from '../mutationHelpers';
import type { IDebtRepository } from '@/domain/debt/IDebtRepository';
import type {
  Debt, DebtTransaction, DebtTransactionType, DebtTransactionSource, DebtKind, AmortizationMethod,
} from '@/domain/debt/Debt';

// ---------------------------------------------------------------------------
// Raw SQLite row types (snake_case)
// ---------------------------------------------------------------------------

interface DebtRow {
  id: string;
  household_id: string;
  name: string;
  description: string | null;
  initial_amount: number;
  currency: string;
  disbursed_at: string;
  // Nullable locally: rows synced before the financial-debts migration lack them
  kind: string | null;
  lender: string | null;
  interest_rate: number | null;
  amortization: string | null;
  term_months: number | null;
  installment_amount: number | null;
  monthly_fees: number | null;
  created_by: string;
  created_at: string;
  deleted_at: string | null;
  updated_at: string;
  last_edited_by: string | null;
  last_edited_at: string | null;
}

interface DebtTransactionRow {
  id: string;
  household_id: string;
  debt_id: string;
  amount: number;
  interest_amount: number | null;
  fees_amount: number | null;
  original_amount: number | null;
  original_currency: string | null;
  exchange_rate: number | null;
  type: string;
  note: string | null;
  date: string;
  source: string;
  expense_id: string | null;
  created_by: string;
  created_at: string;
  deleted_at: string | null;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapDebt(row: DebtRow): Debt {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    description: row.description,
    initialAmount: row.initial_amount,
    currency: row.currency,
    disbursedAt: row.disbursed_at,
    kind: (row.kind ?? 'personal') as DebtKind,
    lender: row.lender,
    interestRate: row.interest_rate ?? 0,
    amortization: (row.amortization ?? 'none') as AmortizationMethod,
    termMonths: row.term_months,
    installmentAmount: row.installment_amount,
    monthlyFees: row.monthly_fees ?? 0,
    createdBy: row.created_by,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
    updatedAt: row.updated_at,
    lastEditedBy: row.last_edited_by,
    lastEditedAt: row.last_edited_at,
  };
}

function mapTransaction(row: DebtTransactionRow): DebtTransaction {
  return {
    id: row.id,
    householdId: row.household_id,
    debtId: row.debt_id,
    amount: row.amount,
    interestAmount: row.interest_amount ?? 0,
    feesAmount: row.fees_amount ?? 0,
    originalAmount: row.original_amount,
    originalCurrency: row.original_currency,
    exchangeRate: row.exchange_rate,
    type: row.type as DebtTransactionType,
    note: row.note,
    date: row.date,
    source: row.source as DebtTransactionSource,
    expenseId: row.expense_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class PowerSyncDebtRepository implements IDebtRepository {
  async listActive(): Promise<Debt[]> {
    const rows = await db.getAll<DebtRow>(
      `SELECT * FROM debts WHERE deleted_at IS NULL ORDER BY disbursed_at DESC`,
    );
    return rows.map(mapDebt);
  }

  async getById(id: string): Promise<Debt | null> {
    const row = await db.get<DebtRow>(
      `SELECT * FROM debts WHERE id = ? LIMIT 1`,
      [id],
    );
    return row ? mapDebt(row) : null;
  }

  async listTransactions(debtId: string): Promise<DebtTransaction[]> {
    const rows = await db.getAll<DebtTransactionRow>(
      `SELECT * FROM debt_transactions
       WHERE debt_id = ? AND deleted_at IS NULL
       ORDER BY date DESC, created_at DESC`,
      [debtId],
    );
    return rows.map(mapTransaction);
  }

  async listAllTransactions(): Promise<DebtTransaction[]> {
    const rows = await db.getAll<DebtTransactionRow>(
      `SELECT * FROM debt_transactions
       WHERE deleted_at IS NULL
       ORDER BY date DESC, created_at DESC`,
    );
    return rows.map(mapTransaction);
  }
}

// ---------------------------------------------------------------------------
// Write operations
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
  kind?: DebtKind;
  lender?: string | null;
  /** Effective annual rate as a fraction (0.125 = 12.5% E.A.) */
  interest_rate?: number;
  amortization?: AmortizationMethod;
  term_months?: number | null;
  installment_amount?: number | null;
  monthly_fees?: number;
  created_by: string;
}

/** Loan-term columns accepted by insertDebt / updateDebt. */
const DEBT_TERM_FIELDS = [
  'kind', 'lender', 'interest_rate', 'amortization',
  'term_months', 'installment_amount', 'monthly_fees',
] as const;

export async function insertDebt(payload: InsertDebtPayload, userId: string): Promise<string> {
  assertAuth(payload.household_id, userId);
  const id = newId();
  const stamp = authorshipStamp(userId);
  const ts = now();
  await db.execute(
    `INSERT INTO debts
       (id, household_id, name, description, initial_amount, currency, disbursed_at,
        kind, lender, interest_rate, amortization, term_months, installment_amount, monthly_fees,
        created_by, created_at, updated_at, last_edited_by, last_edited_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payload.household_id,
      payload.name,
      payload.description ?? null,
      payload.initial_amount,
      payload.currency,
      payload.disbursed_at,
      payload.kind ?? 'personal',
      payload.lender ?? null,
      payload.interest_rate ?? 0,
      payload.amortization ?? 'none',
      payload.term_months ?? null,
      payload.installment_amount ?? null,
      payload.monthly_fees ?? 0,
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
  patch: Partial<Pick<InsertDebtPayload,
    'name' | 'description' | 'initial_amount' | 'currency' | 'disbursed_at' | (typeof DEBT_TERM_FIELDS)[number]
  >>,
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
  for (const key of DEBT_TERM_FIELDS) {
    if (patch[key] !== undefined) { fields.push(`${key} = ?`); values.push(patch[key]); }
  }

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

export interface InsertDebtTransactionPayload {
  household_id: string;
  debt_id: string;
  /** Principal portion — always COP integer */
  amount: number;
  /** Interest portion (COP integer), default 0 */
  interest_amount?: number;
  /** Insurance / fees portion (COP integer), default 0 */
  fees_amount?: number;
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
       (id, household_id, debt_id, amount, interest_amount, fees_amount, original_amount,
        original_currency, exchange_rate, type, note, date, source, expense_id, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payload.household_id,
      payload.debt_id,
      payload.amount,
      payload.interest_amount ?? 0,
      payload.fees_amount ?? 0,
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
