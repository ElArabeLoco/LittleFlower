import type { COPAmount } from '../shared/types';
import type { DebtTransaction } from './Debt';
import { splitPayment, type LoanTerms, type PaymentSplit } from './amortization';

/**
 * Backfill of debt payments from expenses recorded before the budget was
 * linked to the debt. Each payment is split the same way a new one would be,
 * from the balance the debt had on that date.
 */

/** An expense not yet applied to the debt. */
export interface PastPayment {
  expenseId: string;
  /** 'YYYY-MM-DD' */
  date: string;
  total: COPAmount;
}

/** A movement already on the debt; only its principal moves the balance. */
export type DebtMovement = Pick<DebtTransaction, 'type' | 'amount' | 'date'>;

export interface BackfillEntry extends PastPayment, PaymentSplit {}

export interface BackfillSummary extends PaymentSplit {
  count: number;
  total: COPAmount;
  firstDate: string | null;
  lastDate: string | null;
}

/**
 * Splits past payments in date order. Movements already on the debt count
 * when they are dated on or before the payment.
 */
export function planBackfill(terms: LoanTerms, movements: DebtMovement[], payments: PastPayment[]): BackfillEntry[] {
  const pending = [...movements].sort((a, b) => a.date.localeCompare(b.date));
  let balance = terms.initialAmount;
  let next = 0;

  return [...payments]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(payment => {
      for (; next < pending.length && pending[next].date <= payment.date; next++) {
        const { type, amount } = pending[next];
        balance += type === 'credit' ? amount : -amount;
      }
      const split = splitPayment(payment.total, balance, terms);
      balance -= split.principal;
      return { ...payment, ...split };
    });
}

export function summarizeBackfill(entries: BackfillEntry[]): BackfillSummary {
  const sum = (part: 'total' | keyof PaymentSplit) => entries.reduce((acc, e) => acc + e[part], 0);
  return {
    count: entries.length,
    total: sum('total'),
    principal: sum('principal'),
    interest: sum('interest'),
    fees: sum('fees'),
    firstDate: entries[0]?.date ?? null,
    lastDate: entries.at(-1)?.date ?? null,
  };
}
