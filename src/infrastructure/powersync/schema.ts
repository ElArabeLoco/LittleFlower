/**
 * PowerSync schema — MVP Phase 1.
 *
 * PowerSync uses a local SQLite database (WASM) in the browser, synced from
 * Supabase Postgres via the PowerSync service. This schema defines the LOCAL
 * SQLite table structure.
 *
 * Key differences from the previous Triplit schema:
 *  - PowerSync columns are typed as: text | integer | real (SQLite types)
 *  - Booleans → integer (0/1)
 *  - All optional fields still defined (SQLite allows NULL by default)
 *  - The `id` column is always text (UUID) and is the primary key
 *
 * MVP entities (8): Budget, BudgetMonth, Expense, Income, IncomeMonth,
 *                   ExchangeRate, Household, User
 *
 * Row-level security is enforced in Supabase Postgres (NOT here). PowerSync
 * only syncs rows that pass the Supabase RLS policies, filtered by householdId
 * from the JWT claim.
 */

import { column, Schema, Table } from '@powersync/web';

// ---------------------------------------------------------------------------
// Table definitions
// ---------------------------------------------------------------------------

const households = new Table({
  name: column.text,
  join_code: column.text,  // 6-digit code for inviting household members
  created_at: column.text, // ISO8601
});

const users = new Table({
  household_id: column.text,
  name: column.text,
  email: column.text,
  color: column.text,   // hex color e.g. '#f9a8d4'
  role: column.text,    // 'admin' | 'member'
  created_at: column.text,
});

const budgets = new Table({
  household_id: column.text,
  name: column.text,
  description: column.text,     // nullable
  category_id: column.text,
  start_month: column.text,     // 'YYYY-MM'
  end_month: column.text,       // 'YYYY-MM' nullable — if null, no end date
  default_amount: column.integer,
  payment_mode: column.text,     // 'cash' | 'credit_card' | 'both'
  credit_card_id: column.text,  // nullable, Phase 2
  created_by: column.text,      // userId
  created_at: column.text,
  deleted_at: column.text,      // nullable — soft delete
  last_edited_by: column.text,  // nullable
  last_edited_at: column.text,  // nullable
  debt_id: column.text,         // nullable — FK to debts.id if budget is debt-linked
});

const budget_months = new Table({
  household_id: column.text,
  budget_id: column.text,
  month: column.text,           // 'YYYY-MM'
  amount: column.integer,
  is_executed: column.integer,  // 0 | 1
  notes: column.text,           // nullable
  created_at: column.text,
  updated_at: column.text,
  last_edited_by: column.text,  // nullable
  last_edited_at: column.text,  // nullable
});

const expenses = new Table({
  household_id: column.text,
  budget_id: column.text,
  budget_month_id: column.text,
  amount: column.integer,       // negative = reversal
  note: column.text,            // nullable
  recorded_by: column.text,     // userId
  timestamp: column.text,       // ISO8601 — user-visible date
  created_at: column.text,      // system timestamp — IMMUTABLE
  linked_expense_id: column.text, // nullable — set when reversing another expense
  deleted_at: column.text,      // nullable — MVP soft delete
  paid_with_credit_card: column.integer, // 0 | 1 — mode used for this specific transaction
});

const incomes = new Table({
  household_id: column.text,
  name: column.text,
  person: column.text,          // userId of income recipient
  is_fixed: column.integer,     // 0 | 1
  category: column.text,        // 'Salario' | 'Renta' | 'Otro'
  default_amount: column.integer,
  currency: column.text,        // ISO 4217 e.g. 'USD', 'COP'
  start_month: column.text,     // 'YYYY-MM'
  end_month: column.text,       // 'YYYY-MM' nullable — if null, no end date
  created_by: column.text,
  created_at: column.text,
  deleted_at: column.text,      // nullable
});

const income_months = new Table({
  household_id: column.text,
  income_id: column.text,
  month: column.text,           // 'YYYY-MM'
  real_amount: column.integer,
  currency: column.text,        // ISO 4217 — denormalized from Income
  note: column.text,            // nullable
  // Salary breakdown fields — only populated when income.category = 'Salario'
  // Formula: real_amount = base_salary - deductions + ROUND(extra_days * base_salary * 12 / 260)
  base_salary: column.integer,  // 0 for non-salary incomes
  deductions: column.integer,   // 0 if no deductions
  extra_days: column.integer,   // 0 if no extra days
  updated_at: column.text,
  last_edited_by: column.text,  // nullable
  last_edited_at: column.text,  // nullable
});

const exchange_rates = new Table({
  household_id: column.text,
  from_currency: column.text,   // e.g. 'USD'
  to_currency: column.text,     // always 'COP' for now
  month: column.text,           // 'YYYY-MM'
  rate: column.real,            // float — TRM has decimal precision
  source: column.text,          // 'manual' | 'fallback'
  updated_at: column.text,
  last_edited_by: column.text,  // nullable
  last_edited_at: column.text,  // nullable
});

const debts = new Table({
  household_id: column.text,
  name: column.text,
  description: column.text,        // nullable
  initial_amount: column.integer,  // COP integer — original disbursed amount
  currency: column.text,           // 'COP' | 'USD'
  disbursed_at: column.text,       // 'YYYY-MM-DD'
  created_by: column.text,
  created_at: column.text,
  deleted_at: column.text,         // nullable — soft delete
  updated_at: column.text,
  last_edited_by: column.text,     // nullable
  last_edited_at: column.text,     // nullable
});

const debt_transactions = new Table({
  household_id: column.text,
  debt_id: column.text,
  amount: column.integer,          // always COP integer (converted if USD)
  original_amount: column.integer, // nullable — amount in original currency if USD
  original_currency: column.text,  // nullable — 'USD' if applicable
  exchange_rate: column.real,      // nullable — TRM used at transaction time
  type: column.text,               // 'debit' (payment/abono) | 'credit' (increase)
  note: column.text,               // nullable
  date: column.text,               // 'YYYY-MM-DD'
  source: column.text,             // 'manual' | 'expense'
  expense_id: column.text,         // nullable — FK to expenses.id if source='expense'
  created_by: column.text,
  created_at: column.text,
  deleted_at: column.text,         // nullable — soft delete
});

// ---------------------------------------------------------------------------
// Exported schema
// ---------------------------------------------------------------------------

export const AppSchema = new Schema({
  households,
  users,
  budgets,
  budget_months,
  expenses,
  incomes,
  income_months,
  exchange_rates,
  debts,
  debt_transactions,
});

export type Database = (typeof AppSchema)['types'];
