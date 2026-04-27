/**
 * PowerSyncIncomeRepository — implements IIncomeRepository using PowerSync.
 */

import { db } from '../client';
import { newId, now, authorshipStamp, assertAuth } from '../mutationHelpers';
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
  end_month: string | null;
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
    endMonth: row.end_month,
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

// ---------------------------------------------------------------------------
// Write operations
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

export async function insertIncome(payload: InsertIncomePayload, _userId: string): Promise<string> {
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
  userId: string,
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
  // userId param accepted for future audit logging parity
  void userId;
  await db.execute(`UPDATE incomes SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteIncome(id: string): Promise<void> {
  await db.execute(`UPDATE incomes SET deleted_at = ? WHERE id = ?`, [now(), id]);
}

export interface UpsertIncomeMonthPayload {
  id?: string;
  household_id: string;
  income_id: string;
  month: string;            // 'YYYY-MM'
  real_amount: number;
  currency: string;         // ISO 4217
  note?: string;
  base_salary?: number;
  deductions?: number;
  extra_days?: number;
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
