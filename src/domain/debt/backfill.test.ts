import { describe, it, expect } from 'vitest';
import { eaFromMonthlyRate, type LoanTerms } from './amortization';
import { planBackfill, summarizeBackfill, type PastPayment } from './backfill';

const terms: LoanTerms = {
  initialAmount: 10_000_000,
  interestRate: eaFromMonthlyRate(0.01),
  amortization: 'fixed_installment',
  termMonths: 12,
  installmentAmount: null,
  monthlyFees: 50_000,
};

const jan: PastPayment = { expenseId: 'e-jan', date: '2026-01-15', total: 938_488 };
const feb: PastPayment = { expenseId: 'e-feb', date: '2026-02-15', total: 938_488 };

describe('planBackfill', () => {
  it('splits each payment from the balance left by the previous ones', () => {
    expect(planBackfill(terms, [], [jan, feb])).toEqual([
      { ...jan, fees: 50_000, interest: 100_000, principal: 788_488 },
      { ...feb, fees: 50_000, interest: 92_115, principal: 796_373 },
    ]);
  });

  it('applies payments in date order whatever the input order', () => {
    expect(planBackfill(terms, [], [feb, jan]).map(e => e.expenseId)).toEqual(['e-jan', 'e-feb']);
  });

  it('counts movements already on the debt dated on or before each payment', () => {
    const [, second] = planBackfill(terms, [
      { type: 'debit', amount: 1_000_000, date: '2026-01-20' },
      { type: 'credit', amount: 5_000_000, date: '2026-03-01' },
    ], [jan, feb]);
    expect(second).toMatchObject({ interest: 82_115, principal: 806_373 });
  });

  it('a debt without interest takes every payment as principal', () => {
    const [entry] = planBackfill({ ...terms, interestRate: 0, monthlyFees: 0 }, [], [jan]);
    expect(entry).toMatchObject({ principal: 938_488, interest: 0, fees: 0 });
  });
});

describe('summarizeBackfill', () => {
  it('adds up the parts and keeps the date range', () => {
    expect(summarizeBackfill(planBackfill(terms, [], [jan, feb]))).toEqual({
      count: 2,
      total: 1_876_976,
      principal: 1_584_861,
      interest: 192_115,
      fees: 100_000,
      firstDate: '2026-01-15',
      lastDate: '2026-02-15',
    });
  });

  it('is empty when there is nothing to record', () => {
    expect(summarizeBackfill([])).toMatchObject({ count: 0, total: 0, firstDate: null, lastDate: null });
  });
});
