import { useQuery } from '@powersync/react';
import type { DebtRow, DebtTransactionRow } from './types';

// Rows synced before the financial-debts migration lack the loan-term columns.
const DEBT_COLUMNS = `id, name, description, initial_amount, currency, disbursed_at, household_id,
            COALESCE(kind, 'personal') AS kind, lender,
            COALESCE(interest_rate, 0) AS interest_rate,
            COALESCE(amortization, 'none') AS amortization,
            term_months, installment_amount,
            COALESCE(monthly_fees, 0) AS monthly_fees`;

const DEBT_TX_COLUMNS = `id, debt_id, amount,
            COALESCE(interest_amount, 0) AS interest_amount,
            COALESCE(fees_amount, 0) AS fees_amount,
            original_amount, original_currency, exchange_rate,
            type, note, date, source, expense_id`;

/** All active debts with full data (debt management page). */
export function useDebtsQuery() {
  return useQuery<DebtRow>(
    `SELECT ${DEBT_COLUMNS} FROM debts WHERE deleted_at IS NULL ORDER BY disbursed_at DESC`,
  );
}

/** One active debt by id (projection page, payment split). */
export function useDebtByIdQuery(debtId: string) {
  return useQuery<DebtRow>(
    `SELECT ${DEBT_COLUMNS} FROM debts WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [debtId],
  );
}

/** All debt transactions with full data. */
export function useDebtTransactionsQuery() {
  return useQuery<DebtTransactionRow>(
    `SELECT ${DEBT_TX_COLUMNS}
     FROM debt_transactions WHERE deleted_at IS NULL ORDER BY date DESC, created_at DESC`,
  );
}

/** Active transactions of one debt (descending date). */
export function useDebtTransactionsForDebtQuery(debtId: string) {
  return useQuery<DebtTransactionRow>(
    `SELECT ${DEBT_TX_COLUMNS}
     FROM debt_transactions WHERE debt_id = ? AND deleted_at IS NULL ORDER BY date DESC, created_at DESC`,
    [debtId],
  );
}

/** Lightweight debt row for the dashboard widget. */
export interface DashboardDebtRow {
  id: string;
  name: string;
  initial_amount: number;
  currency: string;
}

/** Lightweight debt list for dashboard (only fields needed to compute balance). */
export function useDashboardDebtsQuery() {
  return useQuery<DashboardDebtRow>(
    `SELECT id, name, initial_amount, currency FROM debts WHERE deleted_at IS NULL`,
  );
}

/** Lightweight transaction row for the dashboard widget. */
export interface DashboardDebtTxRow {
  debt_id: string;
  type: string;
  amount: number;
  date: string;
}

/** Lightweight transaction list for dashboard (ascending date for balance calc). */
export function useDashboardDebtTxsQuery() {
  return useQuery<DashboardDebtTxRow>(
    `SELECT debt_id, type, amount, date
     FROM debt_transactions WHERE deleted_at IS NULL ORDER BY date ASC`,
  );
}

/** Debt id + name pairs for dropdown selects (e.g. budget form). */
export function useDebtOptionsQuery() {
  return useQuery<{ id: string; name: string }>(
    `SELECT id, name FROM debts WHERE deleted_at IS NULL ORDER BY name ASC`,
  );
}

/** Monthly amount budgeted toward a debt in `month` (sum of its active linked budgets). */
export function useLinkedBudgetAmountQuery(debtId: string, month: string) {
  return useQuery<{ total: number | null }>(
    `SELECT SUM(COALESCE(bm.amount, b.default_amount)) AS total
     FROM budgets b
     LEFT JOIN budget_months bm ON bm.budget_id = b.id AND bm.month = ?
     WHERE b.debt_id = ? AND b.deleted_at IS NULL
       AND b.start_month <= ? AND (b.end_month IS NULL OR b.end_month >= ?)`,
    [month, debtId, month, month],
  );
}
