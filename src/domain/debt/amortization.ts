import type { COPAmount, YearMonth } from '../shared/types';
import type { AmortizationMethod, DebtTransaction } from './Debt';

/**
 * Loan amortization math for financial debts.
 *
 * Rates are stored as effective annual (E.A.) fractions, the way Colombian
 * banks quote them; every calculation runs on the equivalent monthly rate.
 * Projections always start from the current balance, so extra payments
 * shorten the plan instead of being ignored.
 */

export interface LoanTerms {
  /** Original amount in COP — basis of the fixed principal per installment */
  initialAmount: COPAmount;
  /** Effective annual rate as a fraction (0.125 = 12.5% E.A.) */
  interestRate: number;
  amortization: AmortizationMethod;
  termMonths: number | null;
  /** Agreed installment without fees; null = computed from the terms */
  installmentAmount: COPAmount | null;
  monthlyFees: COPAmount;
}

export interface PaymentSplit {
  principal: COPAmount;
  interest: COPAmount;
  fees: COPAmount;
}

export interface ScheduleRow extends PaymentSplit {
  /** 1-based position among the remaining installments */
  number: number;
  month: YearMonth;
  /** principal + interest + fees */
  payment: COPAmount;
  /** Balance after this installment */
  balance: COPAmount;
}

/**
 * 'scheduled'      = rows run until the balance reaches zero
 * 'paid_off'       = nothing left to pay
 * 'no_plan'        = not enough terms to project (e.g. personal debt without a budget)
 * 'never_pays_off' = the installment does not cover the interest
 */
export type ProjectionStatus = 'scheduled' | 'paid_off' | 'no_plan' | 'never_pays_off';

export interface AmortizationProjection {
  status: ProjectionStatus;
  rows: ScheduleRow[];
  totals: { principal: COPAmount; interest: COPAmount; fees: COPAmount; paid: COPAmount };
}

/** Safety cap: 100 years of installments. */
const MAX_INSTALLMENTS = 1200;

export function monthlyRateFromEA(ea: number): number {
  return Math.pow(1 + ea, 1 / 12) - 1;
}

export function eaFromMonthlyRate(mv: number): number {
  return Math.pow(1 + mv, 12) - 1;
}

/** French-system installment (cuota fija) without fees. */
export function fixedInstallment(principal: COPAmount, monthlyRate: number, termMonths: number): COPAmount {
  if (monthlyRate === 0) return Math.round(principal / termMonths);
  return Math.round((principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths)));
}

function periodInterest(balance: COPAmount, monthlyRate: number): COPAmount {
  return balance > 0 ? Math.round(balance * monthlyRate) : 0;
}

/**
 * Splits a payment the way lenders apply it: fees first, then the interest
 * accrued on the current balance, and the rest to principal.
 * The three parts always add up to `total`.
 */
export function splitPayment(total: COPAmount, balance: COPAmount, terms: LoanTerms): PaymentSplit {
  const fees = Math.min(total, terms.monthlyFees);
  const interest = Math.min(total - fees, periodInterest(balance, monthlyRateFromEA(terms.interestRate)));
  return { principal: total - fees - interest, interest, fees };
}

function addMonths(month: YearMonth, n: number): YearMonth {
  const [y, m] = month.split('-').map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

function emptyProjection(status: ProjectionStatus): AmortizationProjection {
  return { status, rows: [], totals: { principal: 0, interest: 0, fees: 0, paid: 0 } };
}

/** Principal repaid by the next installment; ≤ 0 when it does not cover the interest. */
type PrincipalRule = (balance: COPAmount, interest: COPAmount) => COPAmount;

/** Null when the terms do not define a plan. */
function principalRule(terms: LoanTerms, monthlyRate: number, monthlyPayment?: COPAmount | null): PrincipalRule | null {
  switch (terms.amortization) {
    case 'fixed_installment': {
      const installment = terms.installmentAmount
        ?? (terms.termMonths ? fixedInstallment(terms.initialAmount, monthlyRate, terms.termMonths) : null);
      return installment ? (_bal, interest) => installment - interest : null;
    }
    case 'fixed_principal': {
      if (!terms.termMonths) return null;
      const principal = Math.round(terms.initialAmount / terms.termMonths);
      return () => principal;
    }
    case 'none':
      // Free payments: project with the monthly amount the household budgets for it.
      return monthlyPayment ? (_bal, interest) => monthlyPayment - terms.monthlyFees - interest : null;
  }
}

/** Remaining installments from `balance`, starting at `firstMonth`. */
export function buildSchedule(
  balance: COPAmount,
  terms: LoanTerms,
  firstMonth: YearMonth,
  /** Monthly amount paid toward a debt without amortization (linked budget) */
  monthlyPayment?: COPAmount | null,
): AmortizationProjection {
  if (balance <= 0) return emptyProjection('paid_off');

  const monthlyRate = monthlyRateFromEA(terms.interestRate);
  const rule = principalRule(terms, monthlyRate, monthlyPayment);
  if (!rule) return emptyProjection('no_plan');

  const rows: ScheduleRow[] = [];
  const totals = { principal: 0, interest: 0, fees: 0, paid: 0 };
  let remaining = balance;

  while (remaining > 0) {
    if (rows.length >= MAX_INSTALLMENTS) return emptyProjection('never_pays_off');
    const interest = periodInterest(remaining, monthlyRate);
    const due = rule(remaining, interest);
    if (due <= 0) return emptyProjection('never_pays_off');

    const principal = Math.min(due, remaining);
    const fees = terms.monthlyFees;
    const payment = principal + interest + fees;
    remaining -= principal;

    rows.push({
      number: rows.length + 1,
      month: addMonths(firstMonth, rows.length),
      principal, interest, fees, payment,
      balance: remaining,
    });
    totals.principal += principal;
    totals.interest += interest;
    totals.fees += fees;
    totals.paid += payment;
  }

  return { status: 'scheduled', rows, totals };
}

type PaymentParts = Pick<DebtTransaction, 'type' | 'amount' | 'interestAmount' | 'feesAmount'>;

/** What has been paid so far, by part. Increases (credits) are not payments. */
export function paidToDate(transactions: PaymentParts[]) {
  let principal = 0, interest = 0, fees = 0;
  for (const tx of transactions) {
    if (tx.type !== 'debit') continue;
    principal += tx.amount;
    interest += tx.interestAmount;
    fees += tx.feesAmount;
  }
  return { principal, interest, fees, total: principal + interest + fees };
}

/** First month still owed: next month once the current one has a payment. */
export function firstPendingMonth(currentMonth: YearMonth, paymentDates: string[]): YearMonth {
  return paymentDates.some(d => d.startsWith(currentMonth)) ? addMonths(currentMonth, 1) : currentMonth;
}
