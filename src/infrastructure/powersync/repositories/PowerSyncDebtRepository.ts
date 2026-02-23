/**
 * PowerSyncDebtRepository — reads debts and debt_transactions from local SQLite.
 *
 * snake_case columns (SQLite) ↔ camelCase domain types (TypeScript).
 * All writes go through mutationWrappers.ts — never call db.execute() here.
 */

import { db } from '../client';
import type { IDebtRepository } from '@/domain/debt/IDebtRepository';
import type { Debt, DebtTransaction, DebtTransactionType, DebtTransactionSource } from '@/domain/debt/Debt';

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
