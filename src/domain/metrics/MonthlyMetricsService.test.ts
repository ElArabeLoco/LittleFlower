import { describe, it, expect } from 'vitest';
import {
  getEffectiveRate,
  computeMonthlyMetrics,
  _totalBudgeted,
  _availableIncome,
  _budgetedBalance,
  _executedBudget,
  _remainingAvailable,
  _pendingBudget,
  _realBalance,
  type BudgetRow,
  type BudgetMonthRow,
  type ExpenseRow,
  type IncomeMonthRow,
  type ExchangeRateRow,
  type MonthlyMetricsInput,
} from './MonthlyMetricsService';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const MONTH = '2025-03';
const PREV_MONTH = '2025-02';
const FUTURE_MONTH = '2025-04';

function makeBudget(id: string, paidWithCreditCard = false): BudgetRow {
  return { id, paidWithCreditCard, defaultAmount: 0 };
}

function makeBudgetMonth(
  budgetId: string,
  amount: number,
  isExecuted = false,
  id = `bm-${budgetId}`,
): BudgetMonthRow {
  return { id, budgetId, month: MONTH, amount, isExecuted };
}

function makeExpense(amount: number, deletedAt: string | null = null, id = `e-${amount}`): ExpenseRow {
  return { id, budgetId: 'b1', budgetMonthId: 'bm-b1', amount, deletedAt };
}

function makeIncomeMonth(
  realAmount: number,
  currency: string,
  id = `im-${currency}`,
): IncomeMonthRow {
  return { id, incomeId: `inc-${currency}`, realAmount, currency };
}

function makeRate(
  fromCurrency: string,
  month: string,
  rate: number,
  source: 'manual' | 'fallback' = 'manual',
): ExchangeRateRow {
  return {
    id: `rate-${fromCurrency}-${month}`,
    fromCurrency,
    toCurrency: 'COP',
    month,
    rate,
    source,
  };
}

function makeInput(overrides: Partial<MonthlyMetricsInput> = {}): MonthlyMetricsInput {
  return {
    month: MONTH,
    budgets: new Map(),
    budgetMonths: [],
    expenses: [],
    incomeMonths: [],
    exchangeRates: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getEffectiveRate
// ---------------------------------------------------------------------------

describe('getEffectiveRate', () => {
  it('returns rate=1 for COP (identity conversion)', () => {
    const result = getEffectiveRate('COP', MONTH, []);
    expect(result).toEqual({ rate: 1, source: 'manual', fromMonth: MONTH });
  });

  it('returns exact match for the given month', () => {
    const rates = [makeRate('USD', MONTH, 4200)];
    const result = getEffectiveRate('USD', MONTH, rates);
    expect(result).toEqual({ rate: 4200, source: 'manual', fromMonth: MONTH });
  });

  it('preserves the source of an exact match (fallback source passes through)', () => {
    const rates = [makeRate('USD', MONTH, 4100, 'fallback')];
    const result = getEffectiveRate('USD', MONTH, rates);
    expect(result.source).toBe('fallback');
    expect(result.rate).toBe(4100);
  });

  it('falls back to most recent prior manual rate when no exact match', () => {
    const rates = [makeRate('USD', PREV_MONTH, 4150)];
    const result = getEffectiveRate('USD', MONTH, rates);
    expect(result).toEqual({ rate: 4150, source: 'fallback', fromMonth: PREV_MONTH });
  });

  it('picks the most recent prior manual rate when multiple exist', () => {
    const rates = [
      makeRate('USD', '2025-01', 4000),
      makeRate('USD', PREV_MONTH, 4150), // more recent
    ];
    const result = getEffectiveRate('USD', MONTH, rates);
    expect(result.fromMonth).toBe(PREV_MONTH);
    expect(result.rate).toBe(4150);
  });

  it('ignores future month rates when looking for fallback', () => {
    // Edge case 13: only rates for future months exist
    const rates = [makeRate('USD', FUTURE_MONTH, 4300)];
    const result = getEffectiveRate('USD', MONTH, rates);
    expect(result).toEqual({ rate: 0, source: null, fromMonth: null });
  });

  it('returns null source when rates array is empty', () => {
    // Edge case 12: empty rates array
    const result = getEffectiveRate('USD', MONTH, []);
    expect(result).toEqual({ rate: 0, source: null, fromMonth: null });
  });

  it('does not use prior non-manual (fallback-sourced) rates for the fallback tier', () => {
    // Only manual rates qualify for the Tier 2 fallback lookup
    const rates = [makeRate('USD', PREV_MONTH, 4100, 'fallback')];
    const result = getEffectiveRate('USD', MONTH, rates);
    expect(result.source).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// _totalBudgeted
// ---------------------------------------------------------------------------

describe('_totalBudgeted', () => {
  it('returns 0 for empty array', () => {
    // Edge case 1: no budgets for month
    expect(_totalBudgeted([])).toBe(0);
  });

  it('sums all budget amounts regardless of isExecuted or paidWithCreditCard', () => {
    const budgetMonths = [
      makeBudgetMonth('b1', 500_000),
      makeBudgetMonth('b2', 1_200_000, true),
      makeBudgetMonth('b3', 0),
    ];
    expect(_totalBudgeted(budgetMonths)).toBe(1_700_000);
  });

  it('handles zero-amount budget correctly', () => {
    // Edge case 10: BudgetMonth.amount = 0
    expect(_totalBudgeted([makeBudgetMonth('b1', 0)])).toBe(0);
  });

  it('handles large COP amounts without overflow', () => {
    // Edge case 11: 10-digit amounts — JS integer safe up to 2^53
    const budgetMonths = [makeBudgetMonth('b1', 10_000_000_000)];
    expect(_totalBudgeted(budgetMonths)).toBe(10_000_000_000);
  });
});

// ---------------------------------------------------------------------------
// _availableIncome
// ---------------------------------------------------------------------------

describe('_availableIncome', () => {
  it('returns 0 and hasMissingRates=false when no incomes', () => {
    // Edge case 2: no income defined
    const result = _availableIncome([], [], MONTH);
    expect(result).toEqual({ total: 0, hasMissingRates: false });
  });

  it('converts USD income using the exchange rate', () => {
    const incomes = [makeIncomeMonth(1000, 'USD')]; // 1000 USD × 4200 = 4,200,000 COP
    const rates = [makeRate('USD', MONTH, 4200)];
    const result = _availableIncome(incomes, rates, MONTH);
    expect(result.total).toBe(4_200_000);
    expect(result.hasMissingRates).toBe(false);
  });

  it('includes COP income without conversion', () => {
    const incomes = [makeIncomeMonth(5_000_000, 'COP')];
    const result = _availableIncome(incomes, [], MONTH);
    expect(result.total).toBe(5_000_000);
    expect(result.hasMissingRates).toBe(false);
  });

  it('excludes USD income with no rate and sets hasMissingRates=true', () => {
    // Edge case 3: income in USD with no ExchangeRate
    const incomes = [makeIncomeMonth(1000, 'USD')];
    const result = _availableIncome(incomes, [], MONTH);
    expect(result.total).toBe(0);
    expect(result.hasMissingRates).toBe(true);
  });

  it('uses fallback rate and does NOT set hasMissingRates when prior rate exists', () => {
    // Edge case 4: ExchangeRate exists for prior month only
    const incomes = [makeIncomeMonth(1000, 'USD')];
    const rates = [makeRate('USD', PREV_MONTH, 4150)];
    const result = _availableIncome(incomes, rates, MONTH);
    expect(result.total).toBe(4_150_000);
    expect(result.hasMissingRates).toBe(false);
  });

  it('handles mixed currencies — some with rates, some without', () => {
    // Edge case 9: multiple income sources, mixed currencies
    const incomes = [
      makeIncomeMonth(5_000_000, 'COP', 'im-cop'),
      makeIncomeMonth(1000, 'USD', 'im-usd'), // has rate
      makeIncomeMonth(500, 'EUR', 'im-eur'), // no rate → excluded
    ];
    const rates = [makeRate('USD', MONTH, 4200)];
    const result = _availableIncome(incomes, rates, MONTH);
    // COP: 5,000,000 | USD: 1000 × 4200 = 4,200,000 | EUR: excluded
    expect(result.total).toBe(9_200_000);
    expect(result.hasMissingRates).toBe(true);
  });

  it('rounds currency conversion to nearest integer', () => {
    const incomes = [makeIncomeMonth(1, 'USD')]; // 1 USD × 4200.75 = 4200.75 → rounds to 4201
    const rates = [makeRate('USD', MONTH, 4200.75)];
    const result = _availableIncome(incomes, rates, MONTH);
    expect(result.total).toBe(4201);
    expect(Number.isInteger(result.total)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// _executedBudget
// ---------------------------------------------------------------------------

describe('_executedBudget', () => {
  it('returns 0 when no budget months', () => {
    expect(_executedBudget([], new Map())).toBe(0);
  });

  it('sums only executed non-credit-card budget amounts', () => {
    const budgets = new Map([
      ['b-cash', makeBudget('b-cash', false)],
      ['b-cc', makeBudget('b-cc', true)],
    ]);
    const budgetMonths = [
      makeBudgetMonth('b-cash', 800_000, true),  // executed cash → included
      makeBudgetMonth('b-cc', 1_200_000, true),  // executed CC → excluded
      makeBudgetMonth('b-cash', 300_000, false), // not executed → excluded
    ];
    expect(_executedBudget(budgetMonths, budgets)).toBe(800_000);
  });

  it('returns 0 when all budgets are credit card budgets', () => {
    // Edge case 5: all budgets are credit card budgets
    const budgets = new Map([['b-cc', makeBudget('b-cc', true)]]);
    const budgetMonths = [makeBudgetMonth('b-cc', 1_200_000, true)];
    expect(_executedBudget(budgetMonths, budgets)).toBe(0);
  });

  it('skips budget months with unknown budgetId', () => {
    const budgets = new Map<string, BudgetRow>(); // empty — no known budgets
    const budgetMonths = [makeBudgetMonth('b-unknown', 500_000, true)];
    expect(_executedBudget(budgetMonths, budgets)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// _pendingBudget
// ---------------------------------------------------------------------------

describe('_pendingBudget', () => {
  it('returns 0 when no budget months', () => {
    expect(_pendingBudget([], new Map())).toBe(0);
  });

  it('sums only unexecuted non-credit-card budget amounts', () => {
    const budgets = new Map([
      ['b-cash', makeBudget('b-cash', false)],
      ['b-cc', makeBudget('b-cc', true)],
    ]);
    const budgetMonths = [
      makeBudgetMonth('b-cash', 800_000, false), // unexecuted cash → included
      makeBudgetMonth('b-cash', 300_000, true),  // executed cash → excluded
      makeBudgetMonth('b-cc', 1_200_000, false), // unexecuted CC → excluded
    ];
    expect(_pendingBudget(budgetMonths, budgets)).toBe(800_000);
  });

  it('returns 0 when all budgets are credit card budgets', () => {
    // Edge case 5 (also applies to pending)
    const budgets = new Map([['b-cc', makeBudget('b-cc', true)]]);
    const budgetMonths = [makeBudgetMonth('b-cc', 1_200_000, false)];
    expect(_pendingBudget(budgetMonths, budgets)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// _budgetedBalance
// ---------------------------------------------------------------------------

describe('_budgetedBalance', () => {
  it('returns availableIncome unchanged when no credit card budgets', () => {
    // Edge case 6: no credit card budgets → totalCreditCardBudgeted = 0
    const budgets = new Map([['b-cash', makeBudget('b-cash', false)]]);
    const budgetMonths = [makeBudgetMonth('b-cash', 500_000)];
    expect(_budgetedBalance(5_000_000, budgetMonths, budgets)).toBe(5_000_000);
  });

  it('subtracts credit card budget slice from available income', () => {
    const budgets = new Map([
      ['b-cc', makeBudget('b-cc', true)],
      ['b-cash', makeBudget('b-cash', false)],
    ]);
    const budgetMonths = [
      makeBudgetMonth('b-cc', 1_200_000),
      makeBudgetMonth('b-cash', 800_000),
    ];
    // availableIncome=5,000,000 - ccTotal=1,200,000 = 3,800,000
    expect(_budgetedBalance(5_000_000, budgetMonths, budgets)).toBe(3_800_000);
  });
});

// ---------------------------------------------------------------------------
// _remainingAvailable
// ---------------------------------------------------------------------------

describe('_remainingAvailable', () => {
  it('returns availableIncome when executedBudget is 0', () => {
    expect(_remainingAvailable(5_000_000, 0)).toBe(5_000_000);
  });

  it('subtracts executedBudget from availableIncome', () => {
    expect(_remainingAvailable(5_000_000, 1_500_000)).toBe(3_500_000);
  });

  it('can return a negative value when executed > available', () => {
    expect(_remainingAvailable(1_000_000, 1_500_000)).toBe(-500_000);
  });
});

// ---------------------------------------------------------------------------
// _realBalance
// ---------------------------------------------------------------------------

describe('_realBalance', () => {
  it('returns availableIncome when there are no expenses or executed credit card items', () => {
    expect(_realBalance(5_000_000, [], [], new Map())).toBe(5_000_000);
  });

  it('subtracts net expenses from available income', () => {
    const expenses = [makeExpense(200_000)];
    expect(_realBalance(5_000_000, expenses, [], new Map())).toBe(4_800_000);
  });

  it('correctly handles negative (reversal) expense amounts', () => {
    // Edge case 7: expense with negative amount (reversal)
    const expenses = [
      makeExpense(200_000, null, 'e1'), // original
      makeExpense(-200_000, null, 'e2'), // reversal — cancels out original
      makeExpense(150_000, null, 'e3'), // new expense
    ];
    // net = 200,000 + (-200,000) + 150,000 = 150,000
    expect(_realBalance(5_000_000, expenses, [], new Map())).toBe(4_850_000);
  });

  it('excludes soft-deleted expenses from the net', () => {
    // Edge case 8: expense with deletedAt set
    const expenses = [
      makeExpense(200_000, null, 'e1'), // active
      makeExpense(100_000, '2025-03-15T10:00:00Z', 'e2'), // soft-deleted → excluded
    ];
    expect(_realBalance(5_000_000, expenses, [], new Map())).toBe(4_800_000);
  });

  it('subtracts executed credit card budget amounts', () => {
    const budgets = new Map([['b-cc', makeBudget('b-cc', true)]]);
    const budgetMonths = [makeBudgetMonth('b-cc', 1_200_000, true)]; // executed CC
    expect(_realBalance(5_000_000, [], budgetMonths, budgets)).toBe(3_800_000);
  });

  it('does NOT subtract unexecuted credit card budget amounts', () => {
    const budgets = new Map([['b-cc', makeBudget('b-cc', true)]]);
    const budgetMonths = [makeBudgetMonth('b-cc', 1_200_000, false)]; // NOT executed
    expect(_realBalance(5_000_000, [], budgetMonths, budgets)).toBe(5_000_000);
  });

  it('combines all deductions: expenses + executed credit card', () => {
    const budgets = new Map([['b-cc', makeBudget('b-cc', true)]]);
    const budgetMonths = [makeBudgetMonth('b-cc', 1_200_000, true)];
    const expenses = [makeExpense(300_000)];
    // 5,000,000 - 300,000 (expense) - 1,200,000 (executed CC) = 3,500,000
    expect(_realBalance(5_000_000, expenses, budgetMonths, budgets)).toBe(3_500_000);
  });
});

// ---------------------------------------------------------------------------
// computeMonthlyMetrics — happy path
// ---------------------------------------------------------------------------

describe('computeMonthlyMetrics — happy path', () => {
  it('computes all 10 output fields correctly for a representative month', () => {
    const budgets = new Map([
      ['b-rent', makeBudget('b-rent', false)], // cash: rent 1,500,000
      ['b-market', makeBudget('b-market', false)], // cash: market 800,000 — unexecuted
      ['b-netflix', makeBudget('b-netflix', true)], // credit card: Netflix 50,000
      ['b-card', makeBudget('b-card', true)], // credit card: card quota 1,200,000 — executed
    ]);

    const budgetMonths: BudgetMonthRow[] = [
      makeBudgetMonth('b-rent', 1_500_000, true),   // executed cash
      makeBudgetMonth('b-market', 800_000, false),   // pending cash
      makeBudgetMonth('b-netflix', 50_000, false),   // pending CC
      makeBudgetMonth('b-card', 1_200_000, true),    // executed CC
    ];

    const incomeMonths: IncomeMonthRow[] = [
      makeIncomeMonth(5_000_000, 'COP', 'im-cop'), // 5,000,000 COP
      makeIncomeMonth(500, 'USD', 'im-usd'),        // 500 × 4200 = 2,100,000 COP
    ];

    const exchangeRates: ExchangeRateRow[] = [makeRate('USD', MONTH, 4200)];

    const expenses: ExpenseRow[] = [
      makeExpense(400_000, null, 'e1'), // market expense
      makeExpense(100_000, null, 'e2'), // another expense
    ];

    const result = computeMonthlyMetrics(
      makeInput({ budgets, budgetMonths, incomeMonths, exchangeRates, expenses }),
    );

    const expectedAvailableIncome = 5_000_000 + 500 * 4200; // 7,100,000
    expect(result.availableIncome).toBe(expectedAvailableIncome);
    expect(result.hasMissingRates).toBe(false);

    expect(result.totalBudgeted).toBe(1_500_000 + 800_000 + 50_000 + 1_200_000); // 3,550,000

    // budgetedBalance = availableIncome - CC total (50,000 + 1,200,000)
    expect(result.budgetedBalance).toBe(expectedAvailableIncome - 1_250_000); // 5,850,000

    expect(result.executedBudget).toBe(1_500_000); // only executed non-CC
    expect(result.pendingBudget).toBe(800_000);    // only pending non-CC

    expect(result.remainingAvailable).toBe(expectedAvailableIncome - 1_500_000); // 5,600,000

    // realBalance = availableIncome - netExpenses(500,000) - executedCC(1,200,000)
    expect(result.realBalance).toBe(expectedAvailableIncome - 500_000 - 1_200_000); // 5,400,000

    expect(result.totalCreditCardBudgeted).toBe(50_000 + 1_200_000); // 1,250,000
    expect(result.totalCreditCardExecuted).toBe(1_200_000);
  });

  it('all outputs are integers', () => {
    const incomes = [makeIncomeMonth(1, 'USD')];
    const rates = [makeRate('USD', MONTH, 4200.75)];
    const result = computeMonthlyMetrics(makeInput({ incomeMonths: incomes, exchangeRates: rates }));
    for (const [key, value] of Object.entries(result)) {
      if (key !== 'hasMissingRates') {
        expect(Number.isInteger(value), `${key} should be integer`).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// computeMonthlyMetrics — edge cases
// ---------------------------------------------------------------------------

describe('computeMonthlyMetrics — edge cases', () => {
  it('edge case 1: no budgets — all budget metrics are 0', () => {
    const result = computeMonthlyMetrics(makeInput());
    expect(result.totalBudgeted).toBe(0);
    expect(result.executedBudget).toBe(0);
    expect(result.pendingBudget).toBe(0);
    expect(result.totalCreditCardBudgeted).toBe(0);
    expect(result.totalCreditCardExecuted).toBe(0);
  });

  it('edge case 2: no income — availableIncome is 0', () => {
    const result = computeMonthlyMetrics(makeInput());
    expect(result.availableIncome).toBe(0);
    expect(result.hasMissingRates).toBe(false);
  });

  it('edge case 3: USD income with no exchange rate — excluded, hasMissingRates=true', () => {
    const incomes = [makeIncomeMonth(1000, 'USD')];
    const result = computeMonthlyMetrics(makeInput({ incomeMonths: incomes }));
    expect(result.availableIncome).toBe(0);
    expect(result.hasMissingRates).toBe(true);
  });

  it('edge case 4: USD income with prior-month fallback rate — included', () => {
    const incomes = [makeIncomeMonth(1000, 'USD')];
    const rates = [makeRate('USD', PREV_MONTH, 4150)];
    const result = computeMonthlyMetrics(
      makeInput({ incomeMonths: incomes, exchangeRates: rates }),
    );
    expect(result.availableIncome).toBe(4_150_000);
    expect(result.hasMissingRates).toBe(false);
  });

  it('edge case 5: all budgets are credit card — executedBudget and pendingBudget are 0', () => {
    const budgets = new Map([
      ['b-cc1', makeBudget('b-cc1', true)],
      ['b-cc2', makeBudget('b-cc2', true)],
    ]);
    const budgetMonths = [
      makeBudgetMonth('b-cc1', 1_200_000, true),
      makeBudgetMonth('b-cc2', 50_000, false),
    ];
    const result = computeMonthlyMetrics(makeInput({ budgets, budgetMonths }));
    expect(result.executedBudget).toBe(0);
    expect(result.pendingBudget).toBe(0);
    expect(result.totalCreditCardBudgeted).toBe(1_250_000);
    expect(result.totalCreditCardExecuted).toBe(1_200_000);
  });

  it('edge case 6: no credit card budgets — totalCreditCardBudgeted is 0', () => {
    const budgets = new Map([['b-cash', makeBudget('b-cash', false)]]);
    const budgetMonths = [makeBudgetMonth('b-cash', 800_000, false)];
    const result = computeMonthlyMetrics(makeInput({ budgets, budgetMonths }));
    expect(result.totalCreditCardBudgeted).toBe(0);
    expect(result.totalCreditCardExecuted).toBe(0);
  });

  it('edge case 7: reversal expense reduces realBalance correctly', () => {
    const expenses = [
      makeExpense(500_000, null, 'e1'), // original
      makeExpense(-500_000, null, 'e2'), // reversal — net = 0
    ];
    const incomes = [makeIncomeMonth(5_000_000, 'COP')];
    const result = computeMonthlyMetrics(
      makeInput({ incomeMonths: incomes, expenses }),
    );
    expect(result.realBalance).toBe(5_000_000); // net expenses = 0
  });

  it('edge case 8: soft-deleted expense is excluded from realBalance', () => {
    const expenses = [
      makeExpense(500_000, null, 'e1'),                    // active
      makeExpense(200_000, '2025-03-10T00:00:00Z', 'e2'), // deleted → excluded
    ];
    const incomes = [makeIncomeMonth(5_000_000, 'COP')];
    const result = computeMonthlyMetrics(makeInput({ incomeMonths: incomes, expenses }));
    expect(result.realBalance).toBe(4_500_000); // only 500,000 subtracted
  });

  it('edge case 9: multiple income sources with mixed currencies', () => {
    const incomes = [
      makeIncomeMonth(5_000_000, 'COP', 'im-cop'),
      makeIncomeMonth(1000, 'USD', 'im-usd'),
      makeIncomeMonth(200, 'EUR', 'im-eur'), // no EUR rate → excluded
    ];
    const rates = [makeRate('USD', MONTH, 4200)];
    const result = computeMonthlyMetrics(makeInput({ incomeMonths: incomes, exchangeRates: rates }));
    expect(result.availableIncome).toBe(5_000_000 + 4_200_000); // 9,200,000
    expect(result.hasMissingRates).toBe(true);
  });

  it('edge case 10: BudgetMonth.amount = 0 contributes 0 to all totals', () => {
    const budgets = new Map([['b-zero', makeBudget('b-zero', false)]]);
    const budgetMonths = [makeBudgetMonth('b-zero', 0, true)];
    const result = computeMonthlyMetrics(makeInput({ budgets, budgetMonths }));
    expect(result.totalBudgeted).toBe(0);
    expect(result.executedBudget).toBe(0);
    expect(result.pendingBudget).toBe(0);
  });

  it('edge case 11: large COP amounts (10 digits) do not overflow', () => {
    const budgets = new Map([['b-big', makeBudget('b-big', false)]]);
    const budgetMonths = [makeBudgetMonth('b-big', 10_000_000_000, false)]; // 10 billion COP
    const incomes = [makeIncomeMonth(10_000_000_000, 'COP')];
    const result = computeMonthlyMetrics(
      makeInput({ budgets, budgetMonths, incomeMonths: incomes }),
    );
    expect(result.totalBudgeted).toBe(10_000_000_000);
    expect(result.availableIncome).toBe(10_000_000_000);
    // JS integers are safe up to 2^53 ≈ 9 quadrillion
    expect(Number.isSafeInteger(result.totalBudgeted)).toBe(true);
    expect(Number.isSafeInteger(result.availableIncome)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Invariant: executedBudget + pendingBudget === totalBudgeted - totalCreditCardBudgeted
// ---------------------------------------------------------------------------

describe('invariant: executedBudget + pendingBudget === totalBudgeted - totalCreditCardBudgeted', () => {
  it('holds for a typical month with mixed budget types', () => {
    const budgets = new Map([
      ['b-cash-exec', makeBudget('b-cash-exec', false)],
      ['b-cash-pend', makeBudget('b-cash-pend', false)],
      ['b-cc-exec', makeBudget('b-cc-exec', true)],
      ['b-cc-pend', makeBudget('b-cc-pend', true)],
    ]);
    const budgetMonths: BudgetMonthRow[] = [
      makeBudgetMonth('b-cash-exec', 1_500_000, true),
      makeBudgetMonth('b-cash-pend', 800_000, false),
      makeBudgetMonth('b-cc-exec', 1_200_000, true),
      makeBudgetMonth('b-cc-pend', 50_000, false),
    ];
    const result = computeMonthlyMetrics(makeInput({ budgets, budgetMonths }));
    expect(result.executedBudget + result.pendingBudget).toBe(
      result.totalBudgeted - result.totalCreditCardBudgeted,
    );
  });

  it('holds when there are no budgets', () => {
    const result = computeMonthlyMetrics(makeInput());
    expect(result.executedBudget + result.pendingBudget).toBe(
      result.totalBudgeted - result.totalCreditCardBudgeted,
    );
  });

  it('holds when all budgets are credit card', () => {
    const budgets = new Map([['b-cc', makeBudget('b-cc', true)]]);
    const budgetMonths = [makeBudgetMonth('b-cc', 1_200_000, true)];
    const result = computeMonthlyMetrics(makeInput({ budgets, budgetMonths }));
    expect(result.executedBudget + result.pendingBudget).toBe(
      result.totalBudgeted - result.totalCreditCardBudgeted,
    );
  });

  it('holds when all budgets are cash', () => {
    const budgets = new Map([
      ['b1', makeBudget('b1', false)],
      ['b2', makeBudget('b2', false)],
    ]);
    const budgetMonths = [
      makeBudgetMonth('b1', 500_000, true),
      makeBudgetMonth('b2', 300_000, false),
    ];
    const result = computeMonthlyMetrics(makeInput({ budgets, budgetMonths }));
    expect(result.executedBudget + result.pendingBudget).toBe(
      result.totalBudgeted - result.totalCreditCardBudgeted,
    );
  });
});
