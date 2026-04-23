import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@/infrastructure/powersync/queries/useBudgetQueries', () => ({
  useBudgetsQuery: vi.fn(),
  useBudgetMonthsForRange: vi.fn(),
}));
vi.mock('@/infrastructure/powersync/queries/useExpenseQueries', () => ({
  useExpenseSumsByModeForRange: vi.fn(),
}));
vi.mock('@/infrastructure/powersync/queries/useIncomeQueries', () => ({
  useActiveIncomes: vi.fn(),
  useIncomeMonthsForRange: vi.fn(),
}));
vi.mock('@/infrastructure/powersync/queries/useExchangeRateQueries', () => ({
  useExchangeRatesForRange: vi.fn(),
}));

import { useBudgetsQuery, useBudgetMonthsForRange } from '@/infrastructure/powersync/queries/useBudgetQueries';
import { useExpenseSumsByModeForRange } from '@/infrastructure/powersync/queries/useExpenseQueries';
import { useActiveIncomes, useIncomeMonthsForRange } from '@/infrastructure/powersync/queries/useIncomeQueries';
import { useExchangeRatesForRange } from '@/infrastructure/powersync/queries/useExchangeRateQueries';
import { useYearViewData } from './useYearViewData';
import type { BudgetRow, BudgetMonthRow, IncomeRow } from '@/infrastructure/powersync/queries/types';

function makeBudgetRow(overrides: Partial<BudgetRow> = {}): BudgetRow {
  return {
    id: 'budget-1',
    name: 'Arriendo',
    description: null,
    category_id: 'housing',
    payment_mode: 'cash',
    default_amount: 1_500_000,
    household_id: 'hh-1',
    start_month: '2025-01',
    end_month: null,
    debt_id: null,
    ...overrides,
  };
}

function makeBudgetMonthRow(overrides: Partial<BudgetMonthRow> = {}): BudgetMonthRow {
  return {
    id: 'bm-1',
    budget_id: 'budget-1',
    month: '2025-03',
    amount: 1_500_000,
    is_executed: 0,
    ...overrides,
  };
}

function makeIncomeRow(overrides: Partial<IncomeRow> = {}): IncomeRow {
  return {
    id: 'inc-1',
    name: 'Salario',
    person: 'user-1',
    is_fixed: 1,
    category: 'salary',
    default_amount: 5_000_000,
    currency: 'COP',
    start_month: '2025-01',
    end_month: null,
    ...overrides,
  };
}

function makeExpenseSumByModeRow(budget_month_id: string, total: number, paid_with_credit_card: 0 | 1 = 0) {
  return { budget_month_id, month: '2025-03', total, paid_with_credit_card };
}

function makeRateRow(month: string, rate: number) {
  return { month, rate };
}

const MONTHS_2025 = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06',
                     '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12'];

describe('useYearViewData', () => {
  beforeEach(() => {
    (useBudgetsQuery as Mock).mockReturnValue({ data: [] });
    (useBudgetMonthsForRange as Mock).mockReturnValue({ data: [] });
    (useExpenseSumsByModeForRange as Mock).mockReturnValue({ data: [] });
    (useActiveIncomes as Mock).mockReturnValue({ data: [] });
    (useIncomeMonthsForRange as Mock).mockReturnValue({ data: [] });
    (useExchangeRatesForRange as Mock).mockReturnValue({ data: [] });
  });

  it('bmMap keys are in format "${budget_id}|${month}"', () => {
    (useBudgetMonthsForRange as Mock).mockReturnValue({
      data: [makeBudgetMonthRow({ budget_id: 'budget-1', month: '2025-03' })],
    });

    const { result } = renderHook(() => useYearViewData(2025, MONTHS_2025));
    expect(result.current.bmMap.has('budget-1|2025-03')).toBe(true);
  });

  it('expenseMap keys are budget_month_id values', () => {
    (useExpenseSumsByModeForRange as Mock).mockReturnValue({
      data: [makeExpenseSumByModeRow('bm-42', 900_000, 0)],
    });

    const { result } = renderHook(() => useYearViewData(2025, MONTHS_2025));
    expect(result.current.expenseMap.has('bm-42')).toBe(true);
    expect(result.current.expenseMap.get('bm-42')).toBe(900_000);
  });

  it('expenseMap combines CC and cash rows for the same budget_month_id', () => {
    (useExpenseSumsByModeForRange as Mock).mockReturnValue({
      data: [
        makeExpenseSumByModeRow('bm-1', 400_000, 1),
        makeExpenseSumByModeRow('bm-1', 200_000, 0),
      ],
    });

    const { result } = renderHook(() => useYearViewData(2025, MONTHS_2025));
    expect(result.current.expenseMap.get('bm-1')).toBe(600_000);
  });

  it('ccExpenseMap contains only CC expense rows', () => {
    (useExpenseSumsByModeForRange as Mock).mockReturnValue({
      data: [
        makeExpenseSumByModeRow('bm-1', 400_000, 1),
        makeExpenseSumByModeRow('bm-1', 200_000, 0),
      ],
    });

    const { result } = renderHook(() => useYearViewData(2025, MONTHS_2025));
    expect(result.current.ccExpenseMap.get('bm-1')).toBe(400_000);
    expect(result.current.cashExpenseMap.get('bm-1')).toBe(200_000);
  });

  it('availableMap computes COP income sum per month', () => {
    (useActiveIncomes as Mock).mockReturnValue({
      data: [
        makeIncomeRow({ id: 'inc-1', default_amount: 3_000_000, currency: 'COP', start_month: '2025-01' }),
        makeIncomeRow({ id: 'inc-2', default_amount: 2_000_000, currency: 'COP', start_month: '2025-01' }),
      ],
    });

    const { result } = renderHook(() => useYearViewData(2025, MONTHS_2025));
    expect(result.current.availableMap.get('2025-03')).toBe(5_000_000);
  });

  it('availableMap converts USD income using exchange rate for that month', () => {
    const trm = 4_200;
    (useActiveIncomes as Mock).mockReturnValue({
      data: [makeIncomeRow({ id: 'inc-usd', default_amount: 1_000, currency: 'USD', start_month: '2025-01' })],
    });
    (useExchangeRatesForRange as Mock).mockReturnValue({
      data: [makeRateRow('2025-03', trm)],
    });

    const { result } = renderHook(() => useYearViewData(2025, MONTHS_2025));
    expect(result.current.availableMap.get('2025-03')).toBe(Math.round(1_000 * trm));
  });

  it('availableMap excludes income whose start_month > the queried month', () => {
    (useActiveIncomes as Mock).mockReturnValue({
      data: [
        makeIncomeRow({ id: 'inc-1', default_amount: 3_000_000, currency: 'COP', start_month: '2025-01' }),
        makeIncomeRow({ id: 'inc-late', default_amount: 2_000_000, currency: 'COP', start_month: '2025-06' }),
      ],
    });

    const { result } = renderHook(() => useYearViewData(2025, MONTHS_2025));
    expect(result.current.availableMap.get('2025-03')).toBe(3_000_000);
    expect(result.current.availableMap.get('2025-06')).toBe(5_000_000);
  });

  it("creditCardBudgets contains budgets with payment_mode 'credit_card'", () => {
    (useBudgetsQuery as Mock).mockReturnValue({
      data: [
        makeBudgetRow({ id: 'cash', payment_mode: 'cash' }),
        makeBudgetRow({ id: 'cc', payment_mode: 'credit_card' }),
      ],
    });

    const { result } = renderHook(() => useYearViewData(2025, MONTHS_2025));
    expect(result.current.creditCardBudgets).toHaveLength(1);
    expect(result.current.creditCardBudgets[0].id).toBe('cc');
  });

  it("cashBudgets contains budgets with payment_mode 'cash'", () => {
    (useBudgetsQuery as Mock).mockReturnValue({
      data: [
        makeBudgetRow({ id: 'cash', payment_mode: 'cash' }),
        makeBudgetRow({ id: 'cc', payment_mode: 'credit_card' }),
      ],
    });

    const { result } = renderHook(() => useYearViewData(2025, MONTHS_2025));
    expect(result.current.cashBudgets).toHaveLength(1);
    expect(result.current.cashBudgets[0].id).toBe('cash');
  });

  it("dual budgets appear in both creditCardBudgets and cashBudgets", () => {
    (useBudgetsQuery as Mock).mockReturnValue({
      data: [
        makeBudgetRow({ id: 'cash', payment_mode: 'cash' }),
        makeBudgetRow({ id: 'cc', payment_mode: 'credit_card' }),
        makeBudgetRow({ id: 'dual', payment_mode: 'both' }),
      ],
    });

    const { result } = renderHook(() => useYearViewData(2025, MONTHS_2025));
    expect(result.current.creditCardBudgets.map(b => b.id)).toContain('dual');
    expect(result.current.cashBudgets.map(b => b.id)).toContain('dual');
    expect(result.current.creditCardBudgets).toHaveLength(2); // cc + dual
    expect(result.current.cashBudgets).toHaveLength(2); // cash + dual
  });

  it('ccMetricsMap calculates budgeted = sum of BudgetMonth amounts for CC budgets for that month', () => {
    const ccBudget = makeBudgetRow({ id: 'cc-1', payment_mode: 'credit_card', default_amount: 2_000_000 });
    const bm = makeBudgetMonthRow({ id: 'bm-cc', budget_id: 'cc-1', month: '2025-03', amount: 1_800_000 });

    (useBudgetsQuery as Mock).mockReturnValue({ data: [ccBudget] });
    (useBudgetMonthsForRange as Mock).mockReturnValue({ data: [bm] });

    const { result } = renderHook(() => useYearViewData(2025, MONTHS_2025));
    const ccMetrics = result.current.ccMetricsMap.get('2025-03');
    expect(ccMetrics?.budgeted).toBe(1_800_000);
  });

  it('cashMetricsMap calculates executed = expense totals from cashExpenseMap', () => {
    const cashBudget = makeBudgetRow({ id: 'cash-1', payment_mode: 'cash', default_amount: 1_000_000 });
    const bm = makeBudgetMonthRow({ id: 'bm-cash', budget_id: 'cash-1', month: '2025-03', amount: 1_000_000 });

    (useBudgetsQuery as Mock).mockReturnValue({ data: [cashBudget] });
    (useBudgetMonthsForRange as Mock).mockReturnValue({ data: [bm] });
    (useExpenseSumsByModeForRange as Mock).mockReturnValue({
      data: [makeExpenseSumByModeRow('bm-cash', 750_000, 0)],
    });

    const { result } = renderHook(() => useYearViewData(2025, MONTHS_2025));
    const cashMetrics = result.current.cashMetricsMap.get('2025-03');
    expect(cashMetrics?.executed).toBe(750_000);
  });

  it('group metrics: pending = max(0, budgeted - executed)', () => {
    const cashBudget = makeBudgetRow({ id: 'cash-1', payment_mode: 'cash', default_amount: 1_000_000 });
    const bm = makeBudgetMonthRow({ id: 'bm-cash', budget_id: 'cash-1', month: '2025-03', amount: 1_000_000 });

    (useBudgetsQuery as Mock).mockReturnValue({ data: [cashBudget] });
    (useBudgetMonthsForRange as Mock).mockReturnValue({ data: [bm] });
    (useExpenseSumsByModeForRange as Mock).mockReturnValue({
      data: [makeExpenseSumByModeRow('bm-cash', 600_000, 0)],
    });

    const { result } = renderHook(() => useYearViewData(2025, MONTHS_2025));
    const cashMetrics = result.current.cashMetricsMap.get('2025-03');
    expect(cashMetrics?.pending).toBe(400_000); // 1M - 600K
  });

  it("dual budget: budgeted amount counts only in CC group, not in cash group", () => {
    const dualBudget = makeBudgetRow({ id: 'dual-1', payment_mode: 'both', default_amount: 500_000 });
    const bm = makeBudgetMonthRow({ id: 'bm-dual', budget_id: 'dual-1', month: '2025-03', amount: 500_000 });

    (useBudgetsQuery as Mock).mockReturnValue({ data: [dualBudget] });
    (useBudgetMonthsForRange as Mock).mockReturnValue({ data: [bm] });
    (useExpenseSumsByModeForRange as Mock).mockReturnValue({
      data: [
        makeExpenseSumByModeRow('bm-dual', 300_000, 1), // CC expenses
        makeExpenseSumByModeRow('bm-dual', 100_000, 0), // cash expenses
      ],
    });

    const { result } = renderHook(() => useYearViewData(2025, MONTHS_2025));
    const ccMetrics = result.current.ccMetricsMap.get('2025-03');
    const cashMetrics = result.current.cashMetricsMap.get('2025-03');

    // CC group: budgeted = 500,000, executed = 300,000 (CC expenses only)
    expect(ccMetrics?.budgeted).toBe(500_000);
    expect(ccMetrics?.executed).toBe(300_000);

    // Cash group: budgeted = 0 (dual doesn't contribute), executed = 100,000 (cash expenses)
    expect(cashMetrics?.budgeted).toBe(0);
    expect(cashMetrics?.executed).toBe(100_000);
  });

  it('returns empty maps when no data', () => {
    const { result } = renderHook(() => useYearViewData(2025, MONTHS_2025));
    expect(result.current.budgets).toEqual([]);
    expect(result.current.bmMap.size).toBe(0);
    expect(result.current.expenseMap.size).toBe(0);
  });
});
