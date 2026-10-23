/**
 * Record descriptions for the sync activity log.
 *
 * Turns a raw row (snake_case SQLite columns, possibly partial) into a
 * SyncRecordChange: a label, an amount, a currency and a month a person can
 * recognise ("Arriendo · 1.500.000 COP · 2026-03").
 *
 * Works on partial data on purpose: a PATCH entry carries only the changed
 * columns and a DELETE entry carries none, so every field may end up null.
 */

import { labelCache, type LabelTable } from './labelCache';
import type { SyncChangeOp, SyncRecordChange } from './types';

/** Resolves a budget / income / debt id to its name. */
export type NameLookup = (table: LabelTable, id: unknown) => string | null;

type Row = Record<string, unknown>;
type DescribedFields = Pick<SyncRecordChange, 'label' | 'amount' | 'currency' | 'month'>;

/** Minimal shape of a PowerSync CrudEntry. */
export interface CrudEntryLike {
  op: string;
  table: string;
  id: string;
  opData?: Row | null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function describeRow(
  table: string,
  op: SyncChangeOp,
  id: string,
  row: Row | null | undefined,
  lookup: NameLookup = labelCache.getName,
): SyncRecordChange {
  return { table, op, id, ...describeFields(table, id, row ?? {}, lookup) };
}

/**
 * Describes a local CRUD entry about to be uploaded.
 *
 * PUT → create, DELETE → delete, PATCH → update — except a PATCH that sets
 * `deleted_at`, which is how the app soft-deletes rows.
 */
export function describeCrudEntry(entry: CrudEntryLike, lookup?: NameLookup): SyncRecordChange {
  return describeRow(entry.table, toChangeOp(entry), entry.id, entry.opData, lookup);
}

/**
 * Every column describeRow reads, plus `deleted_at` (soft deletes). Keeping
 * only these is enough to describe a row later — even once it is gone.
 */
export const DESCRIBED_COLUMNS = [
  'name',
  'note',
  'amount',
  'default_amount',
  'real_amount',
  'initial_amount',
  'rate',
  'currency',
  'from_currency',
  'to_currency',
  'month',
  'budget_id',
  'income_id',
  'debt_id',
  'subject_type',
  'subject_id',
  'deleted_at',
] as const;

/** The DESCRIBED_COLUMNS of a row (columns it does not have are left out). */
export function describedFields(row: Row): Row {
  const fields: Row = {};
  for (const column of DESCRIBED_COLUMNS) {
    if (column in row) fields[column] = row[column];
  }
  return fields;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

const NO_FIELDS: DescribedFields = { label: null, amount: null, currency: null, month: null };

function toChangeOp({ op, opData }: CrudEntryLike): SyncChangeOp {
  if (op === 'PUT') return 'create';
  if (op === 'DELETE') return 'delete';
  return text(opData?.['deleted_at']) !== null ? 'delete' : 'update';
}

function describeFields(table: string, id: string, row: Row, lookup: NameLookup): DescribedFields {
  // Own-name fallback (budgets / incomes / debts): partial PATCHes and DELETEs
  // do not carry `name`, but the row's name may already be cached.
  const name = (own: LabelTable) => text(row['name']) ?? text(lookup(own, id));

  switch (table) {
    case 'budgets':
      return { label: name('budgets'), amount: num(row['default_amount']), currency: 'COP', month: null };
    case 'budget_months':
      return {
        label: text(lookup('budgets', row['budget_id'])),
        amount: num(row['amount']),
        currency: 'COP',
        month: text(row['month']),
      };
    case 'expenses':
      return {
        label: text(row['note']) ?? text(lookup('budgets', row['budget_id'])),
        amount: num(row['amount']), // negative = reversal
        currency: 'COP',
        month: null,
      };
    case 'incomes':
      return {
        label: name('incomes'),
        amount: num(row['default_amount']),
        currency: text(row['currency']),
        month: null,
      };
    case 'income_months':
      return {
        label: text(lookup('incomes', row['income_id'])) ?? text(row['note']),
        amount: num(row['real_amount']),
        currency: text(row['currency']),
        month: text(row['month']),
      };
    case 'exchange_rates': {
      const from = text(row['from_currency']);
      const to = text(row['to_currency']);
      return {
        label: from && to ? `${from}/${to}` : null,
        amount: num(row['rate']),
        currency: to,
        month: text(row['month']),
      };
    }
    case 'debts':
      return {
        label: name('debts'),
        amount: num(row['initial_amount']),
        currency: text(row['currency']),
        month: null,
      };
    case 'debt_transactions':
      return {
        label: text(row['note']) ?? text(lookup('debts', row['debt_id'])),
        amount: num(row['amount']),
        currency: 'COP',
        month: null,
      };
    case 'household_members':
      return { ...NO_FIELDS, label: text(row['name']) };
    case 'holders': {
      // A holder is described by what it belongs to: the income or debt name.
      const subjectType = row['subject_type'];
      const subjectTable = subjectType === 'income' ? 'incomes' : subjectType === 'debt' ? 'debts' : null;
      return { ...NO_FIELDS, label: subjectTable ? text(lookup(subjectTable, row['subject_id'])) : null };
    }
    case 'households':
    case 'users':
      return { ...NO_FIELDS, label: text(row['name']) };
    default:
      return NO_FIELDS;
  }
}

/** Trimmed string, or null when absent / empty / not a string. */
function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Finite number, coercing numeric strings; null otherwise. */
function num(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
