import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@/infrastructure/powersync/queries/useBudgetQueries', () => ({
  useBudgetsQuery: vi.fn(),
  useBudgetMonthsForRange: vi.fn(),
}));
vi.mock('@/infrastructure/powersync/queries/useExpenseQueries', () => ({
  useExpenseSumsForRange: vi.fn(),
}));
vi.mock('@/infrastructure/powersync/queries/useIncomeQueries', () => ({
  useActiveIncomes: vi.fn(),
  useIncomeMonthsForRange: vi.fn(),
}));
vi.mock('@/infrastructure/powersync/queries/useExchangeRateQueries', () => ({
  useExchangeRatesForRange: vi.fn(),
}));

import { useBudgetsQuery, useBudgetMonthsForRange } from '@/infrastructure/powersync/queries/useBudgetQueries';
import { useExpenseSumsForRange } from '@/infrastructure/powersync/queries/useExpenseQueries';
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
    paid_with_credit_card: 0,
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

function makeExpenseSumRow(budget_month_id: string, total: number) {
  return { budget_month_id, total };
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
    (useExpenseSumsForRange as Mock).mockReturnValue({ data: [] });
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
    (useExpenseSumsForRange as Mock).mockReturnValue({
      data: [makeExpenseSumRow('bm-42', 900_000)],
    });

    const { result } = renderHook(() => useYearViewData(2025, MONTHS_2025));
    expect(result.current.expenseMap.has('bm-42')).toBe(true);
    expect(result.current.expenseMap.get('bm-42')).toBe(900_000);
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
    // In March, the late-starting income should NOT be included
    expect(result.current.availableMap.get('2025-03')).toBe(3_000_000);
    // In June and beyond, both should be included
    expect(result.current.availableMap.get('2025-06')).toBe(5_000_000);
  });

  it('creditCardBudgets contains only budgets with paid_with_credit_card === 1', () => {
    (useBudgetsQuery as Mock).mockReturnValue({
      data: [
        makeBudgetRow({ id: 'cash', paid_with_credit_card: 0 }),
        makeBudgetRow({ id: 'cc', paid_with_credit_card: 1 }),
      ],
    });

    const { result } = renderHook(() => useYearViewData(2025, MONTHS_2025));
    expect(result.current.creditCardBudgets).toHaveLength(1);
    expect(result.current.creditCardBudgets[0].id).toBe('cc');
  });

  it('cashBudgets contains only budgets with paid_with_credit_card === 0', () => {
    (useBudgetsQuery as Mock).mockReturnValue({
      data: [
        makeBudgetRow({ id: 'cash', paid_with_credit_card: 0 }),
        makeBudgetRow({ id: 'cc', paid_with_credit_card: 1 }),
      ],
    });

    const { result } = renderHook(() => useYearViewData(2025, MONTHS_2025));
    expect(result.current.cashBudgets).toHaveLength(1);
    expect(result.current.cashBudgets[0].id).toBe('cash');
  });

  it('ccMetricsMap calculates budgeted = sum of BudgetMonth amounts for CC budgets for that month', () => {
    const ccBudget = makeBudgetRow({ id: 'cc-1', paid_with_credit_card: 1, default_amount: 2_000_000 });
    const bm = makeBudgetMonthRow({ id: 'bm-cc', budget_id: 'cc-1', month: '2025-03', amount: 1_800_000 });

    (useBudgetsQuery as Mock).mockReturnValue({ data: [ccBudget] });
    (useBudgetMonthsForRange as Mock).mockReturnValue({ data: [bm] });

    const { result } = renderHook(() => useYearViewData(2025, MONTHS_2025));
    const ccMetrics = result.current.ccMetricsMap.get('2025-03');
    expect(ccMetrics?.budgeted).toBe(1_800_000); // From bm.amount override
  });

  it('cashMetricsMap calculates executed = expense totals from expenseMap', () => {
    const cashBudget = makeBudgetRow({ id: 'cash-1', paid_with_credit_card: 0, default_amount: 1_000_000 });
    const bm = makeBudgetMonthRow({ id: 'bm-cash', budget_id: 'cash-1', month: '2025-03', amount: 1_000_000 });

    (useBudgetsQuery as Mock).mockReturnValue({ data: [cashBudget] });
    (useBudgetMonthsForRange as Mock).mockReturnValue({ data: [bm] });
    (useExpenseSumsForRange as Mock).mockReturnValue({
      data: [makeExpenseSumRow('bm-cash', 750_000)],
    });

    const { result } = renderHook(() => useYearViewData(2025, MONTHS_2025));
    const cashMetrics = result.current.cashMetricsMap.get('2025-03');
    expect(cashMetrics?.executed).toBe(750_000);
  });

  it('group metrics: pending = max(0, budgeted - executed)', () => {
    const cashBudget = makeBudgetRow({ id: 'cash-1', paid_with_credit_card: 0, default_amount: 1_000_000 });
    const bm = makeBudgetMonthRow({ id: 'bm-cash', budget_id: 'cash-1', month: '2025-03', amount: 1_000_000 });

    (useBudgetsQuery as Mock).mockReturnValue({ data: [cashBudget] });
    (useBudgetMonthsForRange as Mock).mockReturnValue({ data: [bm] });
    (useExpenseSumsForRange as Mock).mockReturnValue({
      data: [makeExpenseSumRow('bm-cash', 600_000)],
    });

    const { result } = renderHook(() => useYearViewData(2025, MONTHS_2025));
    const cashMetrics = result.current.cashMetricsMap.get('2025-03');
    expect(cashMetrics?.pending).toBe(400_000); // 1M - 600K
  });

  it('returns empty maps when no data', () => {
    const { result } = renderHook(() => useYearViewData(2025, MONTHS_2025));
    expect(result.current.budgets).toEqual([]);
    expect(result.current.bmMap.size).toBe(0);
    expect(result.current.expenseMap.size).toBe(0);
  });
});
