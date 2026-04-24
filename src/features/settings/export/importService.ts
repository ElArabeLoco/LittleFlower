/**
 * importService — client-side data import for LittleFlower.
 *
 * Reads a .lf file (Florecita JSON backup), validates the format, and inserts
 * all records into the local PowerSync SQLite DB via db.execute().
 *
 * Strategy:
 *   - Always replace household_id with the current session's householdId so
 *     the import works both as a restore (same household) and a migration
 *     (new household).
 *   - Skips households and users tables — managed by Supabase Auth.
 *   - For each row: checks if ID already exists, skips if so (idempotent).
 *   - PowerSync queues the new records and syncs them to Supabase when online.
 */

import { db } from '@/infrastructure/powersync/client';
import type { FlorecitaExport, ImportResult } from './types';

// ---------------------------------------------------------------------------
// Table column whitelists — prevents inserting unknown columns
// ---------------------------------------------------------------------------

const TABLE_COLUMNS: Record<string, string[]> = {
  budgets: [
    'id', 'household_id', 'name', 'description', 'category_id',
    'start_month', 'end_month', 'default_amount', 'payment_mode',
    'credit_card_id', 'created_by', 'created_at', 'deleted_at',
    'last_edited_by', 'last_edited_at', 'debt_id',
  ],
  budget_months: [
    'id', 'household_id', 'budget_id', 'month', 'amount', 'is_executed',
    'notes', 'created_at', 'updated_at', 'last_edited_by', 'last_edited_at',
  ],
  expenses: [
    'id', 'household_id', 'budget_id', 'budget_month_id', 'amount', 'note',
    'recorded_by', 'timestamp', 'created_at', 'linked_expense_id', 'deleted_at',
  ],
  incomes: [
    'id', 'household_id', 'name', 'person', 'is_fixed', 'category',
    'default_amount', 'currency', 'start_month', 'end_month',
    'created_by', 'created_at', 'deleted_at',
  ],
  income_months: [
    'id', 'household_id', 'income_id', 'month', 'real_amount', 'currency',
    'note', 'base_salary', 'deductions', 'extra_days',
    'updated_at', 'last_edited_by', 'last_edited_at',
  ],
  exchange_rates: [
    'id', 'household_id', 'from_currency', 'to_currency', 'month', 'rate',
    'source', 'updated_at', 'last_edited_by', 'last_edited_at',
  ],
  debts: [
    'id', 'household_id', 'name', 'description', 'initial_amount', 'currency',
    'disbursed_at', 'created_by', 'created_at', 'deleted_at',
    'updated_at', 'last_edited_by', 'last_edited_at',
  ],
  debt_transactions: [
    'id', 'household_id', 'debt_id', 'amount', 'original_amount',
    'original_currency', 'exchange_rate', 'type', 'note', 'date',
    'source', 'expense_id', 'created_by', 'created_at', 'deleted_at',
  ],
};

// Import order respects FK dependencies
const IMPORT_ORDER = [
  'budgets',
  'incomes',
  'debts',
  'budget_months',
  'income_months',
  'exchange_rates',
  'expenses',
  'debt_transactions',
] as const;

// ---------------------------------------------------------------------------
// Core import function
// ---------------------------------------------------------------------------

async function importTable(
  tableName: string,
  rows: Record<string, unknown>[],
  householdId: string,
): Promise<{ imported: number; skipped: number }> {
  const allowedCols = TABLE_COLUMNS[tableName];
  if (!allowedCols || rows.length === 0) return { imported: 0, skipped: 0 };

  // Fetch existing IDs in batches to avoid per-row round trips
  const incomingIds = rows.map(r => r.id as string).filter(Boolean);
  const existingIds = new Set<string>();

  const CHUNK = 100;
  for (let i = 0; i < incomingIds.length; i += CHUNK) {
    const chunk = incomingIds.slice(i, i + CHUNK);
    const placeholders = chunk.map(() => '?').join(',');
    const found = await db.getAll(
      `SELECT id FROM ${tableName} WHERE id IN (${placeholders})`,
      chunk,
    );
    found.forEach(r => existingIds.add((r as Record<string, unknown>).id as string));
  }

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const id = row.id as string;
    if (!id || existingIds.has(id)) { skipped++; continue; }

    // Build insert using whitelisted columns only
    const cols: string[] = [];
    const vals: unknown[] = [];
    for (const col of allowedCols) {
      cols.push(col);
      vals.push(col === 'household_id' ? householdId : (row[col] ?? null));
    }

    const placeholders = cols.map(() => '?').join(', ');
    await db.execute(
      `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`,
      vals,
    );
    imported++;
  }

  return { imported, skipped };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function importFromLF(
  file: File,
  householdId: string,
): Promise<ImportResult> {
  const text = await file.text();
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return { imported: 0, skipped: 0, errors: ['invalid_json'] };
  }

  const data = parsed as Partial<FlorecitaExport>;

  if (data._format !== 'florecita-backup' || data._v !== 1) {
    return { imported: 0, skipped: 0, errors: ['invalid_format'] };
  }

  let totalImported = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  const isDifferentHousehold = data._household_id !== householdId;

  for (const tableName of IMPORT_ORDER) {
    const rows = data[tableName] ?? [];
    try {
      const { imported, skipped } = await importTable(tableName, rows, householdId);
      totalImported += imported;
      totalSkipped += skipped;
    } catch (err) {
      errors.push(`${tableName}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    imported: totalImported,
    skipped: totalSkipped,
    errors: isDifferentHousehold ? ['different_household', ...errors] : errors,
  };
}
