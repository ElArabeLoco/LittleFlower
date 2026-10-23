import { describe, it, expect } from 'vitest';
import {
  monthlyRateFromEA,
  eaFromMonthlyRate,
  fixedInstallment,
  splitPayment,
  buildSchedule,
  paidToDate,
  firstPendingMonth,
  type LoanTerms,
} from './amortization';

/** E.A. equivalent to exactly 1% per month — keeps expected values readable. */
const EA_1PCT_MONTHLY = eaFromMonthlyRate(0.01);

function makeTerms(overrides: Partial<LoanTerms> = {}): LoanTerms {
  return {
    initialAmount: 10_000_000,
    interestRate: EA_1PCT_MONTHLY,
    amortization: 'fixed_installment',
    termMonths: 12,
    installmentAmount: null,
    monthlyFees: 0,
    ...overrides,
  };
}

const PERSONAL: LoanTerms = {
  initialAmount: 2_000_000,
  interestRate: 0,
  amortization: 'none',
  termMonths: null,
  installmentAmount: null,
  monthlyFees: 0,
};

describe('rate conversion', () => {
  it('converts 12% E.A. to its monthly equivalent', () => {
    expect(monthlyRateFromEA(0.12)).toBeCloseTo(0.0094888, 7);
  });

  it('converts 1% M.V. to E.A.', () => {
    expect(eaFromMonthlyRate(0.01)).toBeCloseTo(0.126825, 6);
  });

  it('round-trips between E.A. and M.V.', () => {
    expect(monthlyRateFromEA(eaFromMonthlyRate(0.0175))).toBeCloseTo(0.0175, 10);
  });

  it('a zero rate stays zero', () => {
    expect(monthlyRateFromEA(0)).toBe(0);
  });
});

describe('fixedInstallment', () => {
  it('matches the standard PMT value (10M, 1% monthly, 12 months)', () => {
    expect(fixedInstallment(10_000_000, 0.01, 12)).toBe(888_488);
  });

  it('splits evenly when the rate is zero', () => {
    expect(fixedInstallment(1_200_000, 0, 12)).toBe(100_000);
  });
});

describe('splitPayment', () => {
  it('personal debts put the whole payment on principal', () => {
    expect(splitPayment(500_000, 2_000_000, PERSONAL)).toEqual({
      principal: 500_000, interest: 0, fees: 0,
    });
  });

  it('applies fees first, then the period interest, then principal', () => {
    const terms = makeTerms({ monthlyFees: 50_000 });
    expect(splitPayment(938_488, 10_000_000, terms)).toEqual({
      principal: 788_488, interest: 100_000, fees: 50_000,
    });
  });

  it('a payment below fees + interest leaves principal at zero', () => {
    const terms = makeTerms({ monthlyFees: 50_000 });
    expect(splitPayment(120_000, 10_000_000, terms)).toEqual({
      principal: 0, interest: 70_000, fees: 50_000,
    });
  });

  it('a payment below the fees only covers fees', () => {
    const terms = makeTerms({ monthlyFees: 50_000 });
    expect(splitPayment(30_000, 10_000_000, terms)).toEqual({
      principal: 0, interest: 0, fees: 30_000,
    });
  });

  it('no interest accrues on a settled balance', () => {
    expect(splitPayment(100_000, 0, makeTerms())).toEqual({
      principal: 100_000, interest: 0, fees: 0,
    });
  });

  it('the parts always add up to the payment', () => {
    const terms = makeTerms({ monthlyFees: 12_345 });
    for (const total of [1, 99_999, 888_488, 3_000_000]) {
      const s = splitPayment(total, 7_654_321, terms);
      expect(s.principal + s.interest + s.fees).toBe(total);
    }
  });
});

describe('buildSchedule — fixed installment', () => {
  it('pays the loan off in its term with a constant installment', () => {
    const p = buildSchedule(10_000_000, makeTerms(), '2026-11');
    expect(p.status).toBe('scheduled');
    expect(p.rows).toHaveLength(12);
    expect(p.rows[0]).toMatchObject({
      number: 1, month: '2026-11', interest: 100_000, principal: 788_488,
      fees: 0, payment: 888_488, balance: 9_211_512,
    });
    expect(p.rows[11].month).toBe('2027-10');
    expect(p.rows[11].balance).toBe(0);
  });

  it('totals add up and interest matches 12 × PMT − principal', () => {
    const p = buildSchedule(10_000_000, makeTerms(), '2026-11');
    expect(p.totals.principal).toBe(10_000_000);
    expect(Math.abs(p.totals.interest - 661_855)).toBeLessThanOrEqual(12);
    expect(p.totals.paid).toBe(p.totals.principal + p.totals.interest + p.totals.fees);
  });

  it('labels months across the year boundary', () => {
    const p = buildSchedule(10_000_000, makeTerms(), '2026-11');
    expect(p.rows.slice(0, 3).map(r => r.month)).toEqual(['2026-11', '2026-12', '2027-01']);
  });

  it('a lower balance (extra payments) shortens the term, installment unchanged', () => {
    const p = buildSchedule(5_000_000, makeTerms(), '2026-11');
    expect(p.rows).toHaveLength(6);
    expect(p.rows[0].payment).toBe(888_488);
  });

  it('uses the agreed installment when set', () => {
    const p = buildSchedule(10_000_000, makeTerms({ installmentAmount: 1_000_000 }), '2026-11');
    expect(p.rows[0].principal).toBe(900_000);
    expect(p.rows.length).toBeLessThan(12);
  });

  it('adds fees to every installment', () => {
    const p = buildSchedule(10_000_000, makeTerms({ monthlyFees: 50_000 }), '2026-11');
    expect(p.rows[0].payment).toBe(938_488);
    expect(p.totals.fees).toBe(50_000 * p.rows.length);
  });

  it('flags an installment that does not cover interest', () => {
    const p = buildSchedule(10_000_000, makeTerms({ installmentAmount: 90_000 }), '2026-11');
    expect(p.status).toBe('never_pays_off');
    expect(p.rows).toEqual([]);
  });

  it('needs a term or an agreed installment', () => {
    const p = buildSchedule(10_000_000, makeTerms({ termMonths: null }), '2026-11');
    expect(p.status).toBe('no_plan');
  });
});

describe('buildSchedule — fixed principal', () => {
  const terms = makeTerms({
    amortization: 'fixed_principal',
    initialAmount: 1_200_000,
    interestRate: eaFromMonthlyRate(0.02),
  });

  it('repays the same principal every month with decreasing interest', () => {
    const p = buildSchedule(1_200_000, terms, '2026-11');
    expect(p.rows).toHaveLength(12);
    expect(p.rows[0]).toMatchObject({ principal: 100_000, interest: 24_000, payment: 124_000 });
    expect(p.rows[1]).toMatchObject({ principal: 100_000, interest: 22_000 });
    expect(p.rows[11]).toMatchObject({ principal: 100_000, interest: 2_000, balance: 0 });
  });

  it('a lower balance needs fewer installments, the last one partial', () => {
    const p = buildSchedule(650_000, terms, '2026-11');
    expect(p.rows).toHaveLength(7);
    expect(p.rows[6].principal).toBe(50_000);
  });
});

describe('buildSchedule — no amortization (personal)', () => {
  it('has no plan without a monthly payment', () => {
    expect(buildSchedule(1_000_000, PERSONAL, '2026-11').status).toBe('no_plan');
  });

  it('projects with the linked budget amount', () => {
    const p = buildSchedule(1_000_000, PERSONAL, '2026-11', 300_000);
    expect(p.rows.map(r => r.principal)).toEqual([300_000, 300_000, 300_000, 100_000]);
    expect(p.totals.interest).toBe(0);
  });

  it('a settled debt is paid off', () => {
    const p = buildSchedule(0, PERSONAL, '2026-11', 300_000);
    expect(p.status).toBe('paid_off');
    expect(p.rows).toEqual([]);
  });
});

describe('paidToDate', () => {
  it('sums the parts of every payment and ignores increases', () => {
    const totals = paidToDate([
      { type: 'debit', amount: 700_000, interestAmount: 250_000, feesAmount: 50_000 },
      { type: 'debit', amount: 720_000, interestAmount: 230_000, feesAmount: 50_000 },
      { type: 'credit', amount: 999_000, interestAmount: 0, feesAmount: 0 },
    ]);
    expect(totals).toEqual({
      principal: 1_420_000, interest: 480_000, fees: 100_000, total: 2_000_000,
    });
  });
});

describe('firstPendingMonth', () => {
  it('is the current month when nothing was paid in it', () => {
    expect(firstPendingMonth('2026-10', ['2026-09-05'])).toBe('2026-10');
  });

  it('moves to next month once the current one is paid', () => {
    expect(firstPendingMonth('2026-12', ['2026-12-03'])).toBe('2027-01');
  });
});
