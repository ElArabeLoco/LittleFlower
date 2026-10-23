import type { DebtKind, AmortizationMethod } from '@/domain/debt/Debt';
import {
  buildSchedule,
  eaFromMonthlyRate,
  firstPendingMonth,
  fixedInstallment,
  monthlyRateFromEA,
  paidToDate,
  splitPayment,
  type AmortizationProjection,
  type LoanTerms,
  type PaymentSplit,
} from '@/domain/debt/amortization';
import type { DebtRow, DebtTransactionRow } from '@/infrastructure/powersync/queries/types';

export type { DebtKind, AmortizationMethod, AmortizationProjection, PaymentSplit };

export const DEBT_KINDS: DebtKind[] = ['personal', 'mortgage', 'credit_card', 'loan', 'other'];
export const AMORTIZATION_METHODS: AmortizationMethod[] = ['fixed_installment', 'fixed_principal', 'none'];

/** How a rate is quoted: effective annual (E.A.) or monthly (M.V.). */
export type RatePeriod = 'EA' | 'MV';

export function isFinancialDebt(kind: string): boolean {
  return kind !== 'personal';
}

/** Default amortization when a debt becomes financial. */
export function defaultAmortization(kind: DebtKind): AmortizationMethod {
  if (kind === 'personal') return 'none';
  return kind === 'credit_card' ? 'fixed_principal' : 'fixed_installment';
}

/** Rate typed as a percentage → stored E.A. fraction. */
export function toEffectiveAnnual(percent: number, period: RatePeriod): number {
  const fraction = percent / 100;
  return period === 'EA' ? fraction : eaFromMonthlyRate(fraction);
}

/** Stored E.A. fraction → both quotes as percentages. */
export function ratePercents(ea: number): { ea: number; mv: number } {
  return { ea: ea * 100, mv: monthlyRateFromEA(ea) * 100 };
}

/** French installment the bank would compute for these terms. */
export function computedInstallment(initialAmount: number, ea: number, termMonths: number): number {
  return fixedInstallment(initialAmount, monthlyRateFromEA(ea), termMonths);
}

export function toLoanTerms(debt: DebtRow, initialCOP: number): LoanTerms {
  return {
    initialAmount: initialCOP,
    interestRate: debt.interest_rate,
    amortization: debt.amortization as AmortizationMethod,
    termMonths: debt.term_months,
    installmentAmount: debt.installment_amount,
    monthlyFees: debt.monthly_fees,
  };
}

/**
 * Remaining installments of a debt from its current balance.
 * `monthlyPayment` paces debts without amortization (linked budget amount).
 */
export function projectDebt(
  debt: DebtRow,
  initialCOP: number,
  balance: number,
  transactions: Pick<DebtTransactionRow, 'type' | 'date'>[],
  currentMonth: string,
  monthlyPayment?: number | null,
): AmortizationProjection {
  const paymentDates = transactions.filter(tx => tx.type === 'debit').map(tx => tx.date);
  return buildSchedule(
    balance,
    toLoanTerms(debt, initialCOP),
    firstPendingMonth(currentMonth, paymentDates),
    monthlyPayment,
  );
}

/** Suggested principal / interest / fees for a payment of `total`. */
export function suggestPaymentSplit(total: number, debt: DebtRow, initialCOP: number, balance: number): PaymentSplit {
  return splitPayment(total, balance, toLoanTerms(debt, initialCOP));
}

/** Principal, interest and fees paid so far. */
export function debtPaidToDate(transactions: Pick<DebtTransactionRow, 'type' | 'amount' | 'interest_amount' | 'fees_amount'>[]) {
  return paidToDate(transactions.map(tx => ({
    type: tx.type as 'debit' | 'credit',
    amount: tx.amount,
    interestAmount: tx.interest_amount,
    feesAmount: tx.fees_amount,
  })));
}
