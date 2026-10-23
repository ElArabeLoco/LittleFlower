import { describe, it, expect } from 'vitest';
import {
  defaultAmortization,
  projectDebt,
  ratePercents,
  suggestPaymentSplit,
  toEffectiveAnnual,
} from './debtPlan';
import type { DebtRow } from '@/infrastructure/powersync/queries/types';

function makeDebt(overrides: Partial<DebtRow> = {}): DebtRow {
  return {
    id: 'debt-1',
    name: 'Hipoteca',
    description: null,
    initial_amount: 10_000_000,
    currency: 'COP',
    disbursed_at: '2026-01-01',
    household_id: 'hh-1',
    kind: 'mortgage',
    lender: 'Banco',
    interest_rate: toEffectiveAnnual(1, 'MV'),
    amortization: 'fixed_installment',
    term_months: 12,
    installment_amount: null,
    monthly_fees: 0,
    ...overrides,
  };
}

describe('rate input', () => {
  it('keeps an E.A. percentage as a fraction', () => {
    expect(toEffectiveAnnual(12.5, 'EA')).toBeCloseTo(0.125, 10);
  });

  it('converts an M.V. percentage to E.A.', () => {
    expect(toEffectiveAnnual(1, 'MV')).toBeCloseTo(0.126825, 6);
  });

  it('shows both quotes for a stored rate', () => {
    const { ea, mv } = ratePercents(toEffectiveAnnual(1, 'MV'));
    expect(ea).toBeCloseTo(12.6825, 4);
    expect(mv).toBeCloseTo(1, 10);
  });
});

describe('defaultAmortization', () => {
  it('credit cards repay a fixed principal, other lenders a fixed installment', () => {
    expect(defaultAmortization('credit_card')).toBe('fixed_principal');
    expect(defaultAmortization('mortgage')).toBe('fixed_installment');
    expect(defaultAmortization('personal')).toBe('none');
  });
});

describe('projectDebt', () => {
  it('starts this month when it has no payment yet', () => {
    const p = projectDebt(makeDebt(), 10_000_000, 10_000_000, [], '2026-10');
    expect(p.rows[0].month).toBe('2026-10');
    expect(p.rows).toHaveLength(12);
  });

  it('starts next month once this month is paid', () => {
    const p = projectDebt(makeDebt(), 10_000_000, 9_211_512, [{ type: 'debit', date: '2026-10-05' }], '2026-10');
    expect(p.rows[0].month).toBe('2026-11');
    expect(p.rows).toHaveLength(11);
  });
});

describe('suggestPaymentSplit', () => {
  it('splits a mortgage installment into interest and principal', () => {
    expect(suggestPaymentSplit(888_488, makeDebt(), 10_000_000, 10_000_000)).toEqual({
      principal: 788_488, interest: 100_000, fees: 0,
    });
  });
});
