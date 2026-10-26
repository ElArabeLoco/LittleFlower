import type { PaymentMode } from '@/domain/budget/Budget';
import type { BudgetExpenseRangeError, ExpenseSpan } from '@/domain/budget/budgetLifecycle';

export type { ExpenseSpan };

/** 'YYYY-MM' as "mar 2025" (short) or "noviembre 2026" (full), using the active language's month names. */
export function formatMonthLabel(
  month: string,
  names: { shortLower: Record<string, string>; full: Record<string, string> },
  style: 'short' | 'full',
): string {
  const [y, m] = month.split('-');
  const name = style === 'short' ? names.shortLower[m] : names.full[m]?.toLowerCase();
  return `${name ?? m} ${y}`;
}

/** Translated message for a repository range error. */
export function rangeErrorMessage(
  err: BudgetExpenseRangeError,
  t: { budgets: { deleteHasExpenses: string; rangeStartError: (m: string) => string; rangeEndError: (m: string) => string }; months: { shortLower: Record<string, string>; full: Record<string, string> } },
): string {
  if (err.kind === 'delete' || !err.limit) return t.budgets.deleteHasExpenses;
  const label = formatMonthLabel(err.limit, t.months, 'short');
  return err.kind === 'start' ? t.budgets.rangeStartError(label) : t.budgets.rangeEndError(label);
}


export interface BudgetRow {
  id: string;
  name: string;
  description: string | null;
  category_id: string;
  start_month: string;
  end_month: string | null;
  default_amount: number;
  payment_mode: string;
  household_id: string;
  debt_id: string | null;
}

export interface DebtOption {
  id: string;
  name: string;
}

export interface BudgetFormState {
  name: string;
  description: string;
  category_id: string;
  start_month: string;
  end_month: string;
  default_amount: string;
  payment_mode: PaymentMode;
  debt_id: string;
}
