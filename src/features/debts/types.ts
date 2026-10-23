import type { DebtKind, AmortizationMethod, RatePeriod } from '@/application/debtPlan';

export type { DebtRow, DebtTransactionRow } from '@/application/useDebtSummary';

export interface ExchangeRateRow {
  month: string;
  rate: number;
}

export interface DebtFormState {
  name: string;
  description: string;
  initial_amount: string;
  currency: string;
  disbursed_at: string;
  kind: DebtKind;
  lender: string;
  /** Rate as typed, in percent */
  rate: string;
  rate_period: RatePeriod;
  amortization: AmortizationMethod;
  term_months: string;
  installment_amount: string;
  monthly_fees: string;
  /** Member ids the debt is in the name of; empty = the whole household. */
  holder_ids: string[];
}

export interface TransactionFormState {
  type: 'debit' | 'credit';
  amount: string;
  currency: string;
  exchange_rate: string;
  date: string;
  note: string;
  /** Financial debts: interest and fees included in a payment */
  interest: string;
  fees: string;
}
