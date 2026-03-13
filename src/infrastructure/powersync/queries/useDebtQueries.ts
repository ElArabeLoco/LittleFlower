import { useQuery } from '@powersync/react';
import type { DebtRow, DebtTransactionRow } from './types';

/** All active debts with full data (debt management page). */
export function useDebtsQuery() {
  return useQuery<DebtRow>(
    `SELECT id, name, description, initial_amount, currency, disbursed_at
     FROM debts WHERE deleted_at IS NULL ORDER BY disbursed_at DESC`,
  );
}

/** All debt transactions with full data. */
export function useDebtTransactionsQuery() {
  return useQuery<DebtTransactionRow>(
    `SELECT id, debt_id, amount, original_amount, original_currency, exchange_rate,
            type, note, date, source, expense_id
     FROM debt_transactions WHERE deleted_at IS NULL ORDER BY date DESC, created_at DESC`,
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
