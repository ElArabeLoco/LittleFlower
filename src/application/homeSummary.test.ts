import { describe, expect, it } from 'vitest';
import type { BudgetMonthRow, BudgetRow } from '@/infrastructure/powersync/queries/types';
import { daysLeftInMonth, greetingPeriod, listMonthBudgets, summarizeMonthBalance } from './homeSummary';

const MONTH = '2026-10';

function budget(id: string, overrides: Partial<BudgetRow> = {}): BudgetRow {
  return {
    id,
    name: id,
    description: null,
    category_id: 'otros',
    payment_mode: 'cash',
    default_amount: 100_000,
    household_id: 'h1',
    start_month: '2026-01',
    end_month: null,
    debt_id: null,
    ...overrides,
  };
}

function budgetMonth(budgetId: string, overrides: Partial<BudgetMonthRow> = {}): BudgetMonthRow {
  return { id: `bm-${budgetId}`, budget_id: budgetId, month: MONTH, amount: 100_000, is_executed: 0, ...overrides };
}

function mapOf(...rows: BudgetMonthRow[]) {
  return new Map(rows.map(row => [`${row.budget_id}|${row.month}`, row]));
}

describe('summarizeMonthBalance', () => {
  it('matches the month view: real balance is available minus cash actually spent', () => {
    const summary = summarizeMonthBalance({
      available: 9_450_000,
      budgeted: 7_380_000,
      executed: 5_166_000,
      realSpent: 5_166_000,
    });

    expect(summary.realBalance).toBe(4_284_000);
    expect(summary.toExecute).toBe(2_214_000);
    expect(summary.executedRatio).toBeCloseTo(0.7, 5);
  });

  it('never reports a negative amount to execute, and keeps the ratio past 100%', () => {
    const summary = summarizeMonthBalance({ available: 0, budgeted: 100, executed: 150, realSpent: 150 });

    expect(summary.toExecute).toBe(0);
    expect(summary.executedRatio).toBe(1.5);
    expect(summary.realBalance).toBe(-150);
  });

  it('has a zero ratio when nothing is budgeted', () => {
    expect(summarizeMonthBalance({ available: 10, budgeted: 0, executed: 0, realSpent: 0 }).executedRatio).toBe(0);
  });
});

describe('listMonthBudgets', () => {
  it('lists each budget once even when it is in both payment groups', () => {
    const dual = budget('mercado', { payment_mode: 'both' });
    const result = listMonthBudgets([dual], [dual], mapOf(), MONTH);

    expect(result.all.map(b => b.id)).toEqual(['mercado']);
    expect(result.totalCount).toBe(1);
  });

  it('keeps unexecuted budgets as pending, largest planned amount first', () => {
    const rent = budget('arriendo', { default_amount: 2_100_000 });
    const gym = budget('gimnasio', { default_amount: 95_000 });
    const internet = budget('internet', { payment_mode: 'credit_card', default_amount: 119_900 });
    const paid = budget('agua', { default_amount: 80_000 });

    const result = listMonthBudgets(
      [internet],
      [rent, gym, paid],
      mapOf(budgetMonth('agua', { is_executed: 1, amount: 80_000 }), budgetMonth('gimnasio', { amount: 120_000 })),
      MONTH,
    );

    expect(result.pending.map(b => [b.id, b.amount])).toEqual([
      ['arriendo', 2_100_000],
      ['gimnasio', 120_000],
      ['internet', 119_900],
    ]);
    expect(result.pendingTotal).toBe(2_339_900);
    expect(result.executedCount).toBe(1);
    expect(result.totalCount).toBe(4);
  });

  it('carries the budget month so callers can register expenses or mark it executed', () => {
    const rent = budget('arriendo');
    const bm = budgetMonth('arriendo', { amount: 2_000_000 });
    const [item] = listMonthBudgets([], [rent], mapOf(bm), MONTH).all;

    expect(item.budgetMonth).toBe(bm);
    expect(item.amount).toBe(2_000_000);
    expect(item.paymentMode).toBe('cash');
  });
});

describe('greetingPeriod', () => {
  it('splits the day into morning, afternoon and evening', () => {
    expect(greetingPeriod(5)).toBe('morning');
    expect(greetingPeriod(11)).toBe('morning');
    expect(greetingPeriod(12)).toBe('afternoon');
    expect(greetingPeriod(18)).toBe('afternoon');
    expect(greetingPeriod(19)).toBe('evening');
    expect(greetingPeriod(2)).toBe('evening');
  });
});

describe('daysLeftInMonth', () => {
  it('counts the days after today until the month ends', () => {
    expect(daysLeftInMonth(new Date(2026, 9, 22))).toBe(9);
    expect(daysLeftInMonth(new Date(2026, 9, 31))).toBe(0);
    expect(daysLeftInMonth(new Date(2028, 1, 1))).toBe(28);
  });
});
