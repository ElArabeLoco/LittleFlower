/**
 * PowerSyncIncomeRepository — implements IIncomeRepository using PowerSync.
 */

import { db } from '../client';
import type { IIncomeRepository } from '@/domain/income/IIncomeRepository';
import type { Income, IncomeMonth } from '@/domain/income/Income';

// ---------------------------------------------------------------------------
// Raw row shapes
// ---------------------------------------------------------------------------

interface IncomeRow {
  id: string;
  household_id: string;
  name: string;
  person: string;
  is_fixed: number; // 0 | 1
  category: string;
  default_amount: number;
  currency: string;
  start_month: string;
  created_by: string;
  created_at: string;
  deleted_at: string | null;
}

interface IncomeMonthRow {
  id: string;
  household_id: string;
  income_id: string;
  month: string;
  real_amount: number;
  currency: string;
  note: string | null;
  updated_at: string;
  last_edited_by: string | null;
  last_edited_at: string | null;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function toIncome(row: IncomeRow): Income {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    person: row.person,
    isFixed: row.is_fixed === 1,
    category: row.category as Income['category'],
    defaultAmount: row.default_amount,
    currency: row.currency,
    startMonth: row.start_month,
    createdBy: row.created_by,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

function toIncomeMonth(row: IncomeMonthRow): IncomeMonth {
  return {
    id: row.id,
    householdId: row.household_id,
    incomeId: row.income_id,
    month: row.month,
    realAmount: row.real_amount,
    currency: row.currency,
    note: row.note,
    updatedAt: row.updated_at,
    lastEditedBy: row.last_edited_by,
    lastEditedAt: row.last_edited_at,
  };
}

// ---------------------------------------------------------------------------
// Repository implementation
// ---------------------------------------------------------------------------

export class PowerSyncIncomeRepository implements IIncomeRepository {
  async listActive(): Promise<Income[]> {
    const rows = await db.getAll<IncomeRow>(
      `SELECT * FROM incomes WHERE deleted_at IS NULL ORDER BY name ASC`,
    );
    return rows.map(toIncome);
  }

  async getById(id: string): Promise<Income | null> {
    const row = await db.get<IncomeRow>(`SELECT * FROM incomes WHERE id = ?`, [id]);
    return row ? toIncome(row) : null;
  }

  async listMonthRows(month: string): Promise<IncomeMonth[]> {
    const rows = await db.getAll<IncomeMonthRow>(
      `SELECT * FROM income_months WHERE month = ?`,
      [month],
    );
    return rows.map(toIncomeMonth);
  }

  async getMonthRow(incomeId: string, month: string): Promise<IncomeMonth | null> {
    const row = await db.get<IncomeMonthRow>(
      `SELECT * FROM income_months WHERE income_id = ? AND month = ?`,
      [incomeId, month],
    );
    return row ? toIncomeMonth(row) : null;
  }
}
