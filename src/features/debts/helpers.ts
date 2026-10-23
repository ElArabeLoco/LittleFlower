import { ratePercents, type DebtKind } from '@/application/debtPlan';
import type { DebtFormState, DebtRow } from './types';

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(d: string, monthLabels: Record<string, string>): string {
  const [, m, day] = d.split('-');
  const mm = m.padStart(2, '0');
  return `${parseInt(day)} ${monthLabels[mm] ?? m}`;
}

/** Edit-mode form state for an existing debt and its holders. The rate is shown as E.A. */
export function debtFormFromRow(debt: DebtRow, holderIds: string[]): DebtFormState {
  return {
    name: debt.name,
    description: debt.description ?? '',
    initial_amount: String(debt.initial_amount),
    currency: debt.currency,
    disbursed_at: debt.disbursed_at,
    kind: debt.kind as DebtKind,
    lender: debt.lender ?? '',
    rate: debt.interest_rate ? String(Number(ratePercents(debt.interest_rate).ea.toFixed(4))) : '',
    rate_period: 'EA',
    amortization: debt.amortization as DebtFormState['amortization'],
    term_months: debt.term_months ? String(debt.term_months) : '',
    installment_amount: debt.installment_amount ? String(debt.installment_amount) : '',
    monthly_fees: debt.monthly_fees ? String(debt.monthly_fees) : '',
    holder_ids: holderIds,
  };
}
