import { describe, it, expect } from 'vitest';
import { groupIdOf, hasStarted, lensValue, sumKnown, budgetMonthValue } from './yearViewLens';
import type { BudgetRow, BudgetMonthRow } from '@/infrastructure/powersync/queries/types';

const budget = (over: Partial<BudgetRow> = {}): BudgetRow =>
  ({ id: 'b1', default_amount: 100, start_month: '2026-02', end_month: null, payment_mode: 'cash', ...over }) as BudgetRow;

describe('groupIdOf', () => {
  it('maps payment modes to sheet groups', () => {
    expect(groupIdOf({ payment_mode: 'credit_card' })).toBe('cc');
    expect(groupIdOf({ payment_mode: 'both' })).toBe('dual');
    expect(groupIdOf({ payment_mode: 'cash' })).toBe('cash');
  });
});

describe('hasStarted', () => {
  it('respects start and end months', () => {
    const b = budget({ end_month: '2026-06' });
    expect(hasStarted(b, '2026-01')).toBe(false);
    expect(hasStarted(b, '2026-02')).toBe(true);
    expect(hasStarted(b, '2026-06')).toBe(true);
    expect(hasStarted(b, '2026-07')).toBe(false);
  });
});

describe('lensValue', () => {
  it('plan shows the planned amount for any month', () => {
    expect(lensValue('plan', 100, 40, '2026-12', '2026-10')).toBe(100);
  });
  it('spent and diff are unknown after the current month', () => {
    expect(lensValue('spent', 100, 40, '2026-11', '2026-10')).toBeNull();
    expect(lensValue('diff', 100, 40, '2026-11', '2026-10')).toBeNull();
  });
  it('diff is planned minus spent (negative when over budget)', () => {
    expect(lensValue('diff', 100, 40, '2026-10', '2026-10')).toBe(60);
    expect(lensValue('diff', 100, 130, '2026-09', '2026-10')).toBe(-30);
  });
});

describe('sumKnown', () => {
  it('ignores nulls and returns null when nothing is known', () => {
    expect(sumKnown([1, null, 2])).toBe(3);
    expect(sumKnown([null, null])).toBeNull();
    expect(sumKnown([])).toBeNull();
  });
});

describe('budgetMonthValue', () => {
  const bm = { id: 'bm1', budget_id: 'b1', month: '2026-03', amount: 250 } as BudgetMonthRow;
  const bmMap = new Map([['b1|2026-03', bm]]);
  const expenseMap = new Map([['bm1', 80]]);

  it('uses the month override and spent amount', () => {
    expect(budgetMonthValue('plan', budget(), '2026-03', '2026-10', bmMap, expenseMap)).toBe(250);
    expect(budgetMonthValue('spent', budget(), '2026-03', '2026-10', bmMap, expenseMap)).toBe(80);
    expect(budgetMonthValue('diff', budget(), '2026-03', '2026-10', bmMap, expenseMap)).toBe(170);
  });
  it('falls back to default amount and null before the budget starts', () => {
    expect(budgetMonthValue('plan', budget(), '2026-04', '2026-10', bmMap, expenseMap)).toBe(100);
    expect(budgetMonthValue('plan', budget(), '2026-01', '2026-10', bmMap, expenseMap)).toBeNull();
  });
});

import { summarizeSelection, moveSelection, selectionBounds } from './yearViewLens';

describe('selection helpers', () => {
  const matrix = [
    [10, null, 30],
    [40, 50, null],
  ];

  it('summarizes known values in the range, in any drag direction', () => {
    const s = summarizeSelection(matrix, { ar: 1, ac: 1, fr: 0, fc: 0 });
    expect(s).toEqual({ sum: 100, count: 3, average: 33 });
    expect(selectionBounds({ ar: 1, ac: 1, fr: 0, fc: 0 })).toEqual({ r1: 0, r2: 1, c1: 0, c2: 1 });
  });

  it('returns zeros for an empty range', () => {
    expect(summarizeSelection(matrix, { ar: 0, ac: 1, fr: 0, fc: 1 })).toEqual({ sum: 0, count: 0, average: 0 });
  });

  it('moves and clamps; extends while keeping the anchor', () => {
    const a = { ar: 0, ac: 0, fr: 0, fc: 0 };
    expect(moveSelection(a, -1, -1, false, 2, 3)).toEqual(a);
    expect(moveSelection(a, 1, 2, false, 2, 3)).toEqual({ ar: 1, ac: 2, fr: 1, fc: 2 });
    expect(moveSelection(a, 5, 5, true, 2, 3)).toEqual({ ar: 0, ac: 0, fr: 1, fc: 2 });
  });
});
