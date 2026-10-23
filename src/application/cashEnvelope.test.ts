import { describe, expect, it } from 'vitest';
import { cashEnvelope } from './cashEnvelope';

const budgets = [
  { id: 'arriendo', payment_mode: 'cash', default_amount: 2_000_000 },
  { id: 'mercado', payment_mode: 'both', default_amount: 900_000 },
  { id: 'netflix', payment_mode: 'credit_card', default_amount: 40_000 },
];

describe('cashEnvelope (the month view BalanceCard definition)', () => {
  it('plans only cash budgets: dual budgets plan in the card envelope', () => {
    const result = cashEnvelope({
      budgets,
      budgetMonthByBudgetId: new Map([['arriendo', { id: 'bm-a', amount: 2_100_000 }]]),
      cashSpentByBudgetMonthId: new Map(),
    });

    expect(result.budgeted).toBe(2_100_000);
  });

  it('executes cash-paid expenses of cash and dual budgets', () => {
    const result = cashEnvelope({
      budgets,
      budgetMonthByBudgetId: new Map([
        ['arriendo', { id: 'bm-a', amount: 2_000_000 }],
        ['mercado', { id: 'bm-m', amount: 900_000 }],
        ['netflix', { id: 'bm-n', amount: 40_000 }],
      ]),
      cashSpentByBudgetMonthId: new Map([
        ['bm-a', 2_000_000],
        ['bm-m', 300_000],
        ['bm-n', 40_000],
      ]),
    });

    expect(result.executed).toBe(2_300_000);
  });

  it('counts every cash-paid expense of the month as really spent', () => {
    const result = cashEnvelope({
      budgets,
      budgetMonthByBudgetId: new Map([['netflix', { id: 'bm-n', amount: 40_000 }]]),
      cashSpentByBudgetMonthId: new Map([
        ['bm-n', 40_000],
        ['bm-from-an-ended-budget', 15_000],
      ]),
    });

    expect(result.realSpent).toBe(55_000);
    expect(result.executed).toBe(0);
  });
});
