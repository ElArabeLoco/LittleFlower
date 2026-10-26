import { describe, it, expect } from 'vitest';
import { splitBudgetsByLifecycle } from './useBudgetManagementData';

function b(id: string, name: string, payment_mode: string, end_month: string | null = null) {
  return {
    id, name, description: null, category_id: 'other', payment_mode,
    default_amount: 0, household_id: 'h', start_month: '2025-01', end_month, debt_id: null,
  };
}

describe('splitBudgetsByLifecycle', () => {
  const now = '2025-10';

  it('splits active budgets by payment mode, dual in both', () => {
    const r = splitBudgetsByLifecycle([b('1', 'A', 'credit_card'), b('2', 'B', 'cash'), b('3', 'C', 'both')], now);
    expect(r.creditCard.map(x => x.id)).toEqual(['1', '3']);
    expect(r.cash.map(x => x.id)).toEqual(['2', '3']);
    expect(r.finished).toEqual([]);
  });

  it('keeps a budget ending this month active', () => {
    const r = splitBudgetsByLifecycle([b('1', 'A', 'cash', '2025-10')], now);
    expect(r.cash).toHaveLength(1);
    expect(r.finished).toHaveLength(0);
  });

  it('puts finished budgets in one list, newest end first then by name', () => {
    const r = splitBudgetsByLifecycle([
      b('1', 'Zeta', 'cash', '2025-05'),
      b('2', 'Beta', 'both', '2025-09'),
      b('3', 'Alfa', 'credit_card', '2025-09'),
    ], now);
    expect(r.finished.map(x => x.id)).toEqual(['3', '2', '1']);
    expect(r.cash).toEqual([]);
    expect(r.creditCard).toEqual([]);
  });
});
