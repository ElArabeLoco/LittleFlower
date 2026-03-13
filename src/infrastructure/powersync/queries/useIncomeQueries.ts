import { useQuery } from '@powersync/react';
import type { IncomeRow, IncomeMonthRow } from './types';

/** All active incomes regardless of month (for dashboard charts). */
export function useActiveIncomes() {
  return useQuery<IncomeRow>(
    `SELECT id, name, person, is_fixed, category, default_amount, currency, start_month, end_month
     FROM incomes WHERE deleted_at IS NULL ORDER BY category ASC, name ASC`,
  );
}

/** Incomes that are active during a specific month. */
export function useIncomesForMonth(month: string) {
  return useQuery<IncomeRow>(
    `SELECT id, name, person, is_fixed, category, default_amount, currency, start_month, end_month
     FROM incomes
     WHERE deleted_at IS NULL
       AND start_month <= ?
       AND (end_month IS NULL OR end_month >= ?)
     ORDER BY category ASC, name ASC`,
    [month, month],
  );
}

/** Income month overrides for a single month. */
export function useIncomeMonthsForMonth(month: string) {
  return useQuery<IncomeMonthRow>(
    `SELECT id, income_id, month, real_amount, currency, note, base_salary, deductions, extra_days
     FROM income_months WHERE month = ?`,
    [month],
  );
}

/** Income month overrides for multiple months (dashboard). */
export function useIncomeMonthsForMonths(months: string[]) {
  return useQuery<IncomeMonthRow>(
    months.length > 0
      ? `SELECT income_id, month, real_amount, currency
         FROM income_months WHERE month IN (${months.map(() => '?').join(',')})`
      : `SELECT income_id, month, real_amount, currency FROM income_months WHERE 1=0`,
    months,
  );
}

/** Income month overrides for a calendar year range (YearView). */
export function useIncomeMonthsForRange(fromMonth: string, toMonth: string) {
  return useQuery<IncomeMonthRow>(
    `SELECT income_id, month, real_amount, currency
     FROM income_months WHERE month >= ? AND month <= ?`,
    [fromMonth, toMonth],
  );
}

/** Lightweight income month amounts for AppShell (real_amount + currency only). */
export function useIncomeMonthAmountsForMonth(month: string) {
  return useQuery<{ real_amount: number; currency: string }>(
    `SELECT im.real_amount, im.currency FROM income_months im WHERE im.month = ?`,
    [month],
  );
}
