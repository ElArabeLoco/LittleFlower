import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@/infrastructure/powersync/queries/useBudgetQueries', () => ({
  useBudgetWithExpenseTotals: vi.fn(),
}));
vi.mock('@/infrastructure/powersync/queries/useExpenseQueries', () => ({
  useExpenseSumsByModeForMonth: vi.fn(),
}));
vi.mock('@/infrastructure/powersync/queries/useExchangeRateQueries', () => ({
  useExchangeRateForMonth: vi.fn(),
}));
vi.mock('@/infrastructure/powersync/queries/useIncomeQueries', () => ({
  useIncomeMonthAmountsForMonth: vi.fn(),
}));

import { useBudgetWithExpenseTotals } from '@/infrastructure/powersync/queries/useBudgetQueries';
import { useExpenseSumsByModeForMonth } from '@/infrastructure/powersync/queries/useExpenseQueries';
import { useExchangeRateForMonth } from '@/infrastructure/powersync/queries/useExchangeRateQueries';
import { useIncomeMonthAmountsForMonth } from '@/infrastructure/powersync/queries/useIncomeQueries';
import { useAppShellData } from './useAppShellData';
import type { BudgetWithExpenseTotalsRow } from '@/infrastructure/powersync/queries/useBudgetQueries';

function makeBudgetRow(overrides: Partial<BudgetWithExpenseTotalsRow> = {}): BudgetWithExpenseTotalsRow {
  return {
    id: 'bm-1',
    name: 'Arriendo',
    category_id: 'housing',
    payment_mode: 'cash',
    default_amount: 1_500_000,
    bm_id: 'bm-1',
    bm_amount: 1_500_000,
    bm_is_executed: 0,
    total_expenses: 1_200_000,
    ...overrides,
  };
}

function makeIncomeAmountRow(real_amount: number, currency: string) {
  return { real_amount, currency };
}

describe('useAppShellData', () => {
  beforeEach(() => {
    (useBudgetWithExpenseTotals as Mock).mockReturnValue({ data: [] });
    (useExpenseSumsByModeForMonth as Mock).mockReturnValue({ data: [] });
    (useExchangeRateForMonth as Mock).mockReturnValue({ data: [] });
    (useIncomeMonthAmountsForMonth as Mock).mockReturnValue({ data: [] });
  });

  it("creditCardRows contains only rows where payment_mode is 'credit_card' or 'both'", () => {
    (useBudgetWithExpenseTotals as Mock).mockReturnValue({
      data: [
        makeBudgetRow({ id: 'cash-1', payment_mode: 'cash' }),
        makeBudgetRow({ id: 'cc-1', payment_mode: 'credit_card' }),
        makeBudgetRow({ id: 'dual-1', payment_mode: 'both' }),
      ],
    });

    const { result } = renderHook(() => useAppShellData('2025-03'));
    expect(result.current.creditCardRows).toHaveLength(2);
    expect(result.current.creditCardRows.map(r => r.id)).toContain('cc-1');
    expect(result.current.creditCardRows.map(r => r.id)).toContain('dual-1');
  });

  it("cashRows contains only rows where payment_mode is 'cash' or 'both'", () => {
    (useBudgetWithExpenseTotals as Mock).mockReturnValue({
      data: [
        makeBudgetRow({ id: 'cash-1', payment_mode: 'cash' }),
        makeBudgetRow({ id: 'cc-1', payment_mode: 'credit_card' }),
        makeBudgetRow({ id: 'dual-1', payment_mode: 'both' }),
      ],
    });

    const { result } = renderHook(() => useAppShellData('2025-03'));
    expect(result.current.cashRows).toHaveLength(2);
    expect(result.current.cashRows.map(r => r.id)).toContain('cash-1');
    expect(result.current.cashRows.map(r => r.id)).toContain('dual-1');
  });

  it('totalBudgeted sums bm_amount for all rows (fallback to default_amount when bm_amount is null)', () => {
    (useBudgetWithExpenseTotals as Mock).mockReturnValue({
      data: [
        makeBudgetRow({ bm_amount: 1_000_000, default_amount: 1_500_000 }),
        makeBudgetRow({ id: 'bm-2', bm_amount: null, default_amount: 800_000 }),
      ],
    });

    const { result } = renderHook(() => useAppShellData('2025-03'));
    // 1,000,000 + 800,000 (fallback)
    expect(result.current.totalBudgeted).toBe(1_800_000);
  });

  it("dual budget: planned amount counts in ccBudgeted, not in cashBudgeted", () => {
    (useBudgetWithExpenseTotals as Mock).mockReturnValue({
      data: [
        makeBudgetRow({ id: 'cash-1', payment_mode: 'cash', bm_amount: 1_000_000, total_expenses: 600_000 }),
        makeBudgetRow({ id: 'cc-1', payment_mode: 'credit_card', bm_amount: 2_000_000, total_expenses: 1_200_000 }),
        makeBudgetRow({ id: 'dual-1', payment_mode: 'both', bm_amount: 500_000, total_expenses: 300_000 }),
      ],
    });

    const { result } = renderHook(() => useAppShellData('2025-03'));

    // CC group includes the dual budget's planned amount
    expect(result.current.ccBudgeted).toBe(2_000_000 + 500_000);
    // Cash group excludes the dual budget's planned amount
    expect(result.current.cashBudgeted).toBe(1_000_000);
    // Combined total counts dual once (on the CC side)
    expect(result.current.totalBudgeted).toBe(1_000_000 + 2_000_000 + 500_000);
  });

  it('totalExecuted sums total_expenses for all rows', () => {
    (useBudgetWithExpenseTotals as Mock).mockReturnValue({
      data: [
        makeBudgetRow({ total_expenses: 500_000 }),
        makeBudgetRow({ id: 'bm-2', total_expenses: 700_000 }),
      ],
    });

    const { result } = renderHook(() => useAppShellData('2025-03'));
    expect(result.current.totalExecuted).toBe(1_200_000);
  });

  it('ccExecuted and cashExecuted split expenses by payment mode', () => {
    (useBudgetWithExpenseTotals as Mock).mockReturnValue({
      data: [
        makeBudgetRow({ id: 'cash-1', payment_mode: 'cash', bm_id: 'bm-cash', total_expenses: 500_000 }),
        makeBudgetRow({ id: 'cc-1', payment_mode: 'credit_card', bm_id: 'bm-cc', total_expenses: 700_000 }),
        makeBudgetRow({ id: 'dual-1', payment_mode: 'both', bm_id: 'bm-dual', total_expenses: 300_000 }),
      ],
    });
    (useExpenseSumsByModeForMonth as Mock).mockReturnValue({
      data: [
        { budget_month_id: 'bm-cash', paid_with_credit_card: 0, total: 500_000 },
        { budget_month_id: 'bm-cc', paid_with_credit_card: 1, total: 700_000 },
        { budget_month_id: 'bm-dual', paid_with_credit_card: 1, total: 200_000 },
        { budget_month_id: 'bm-dual', paid_with_credit_card: 0, total: 100_000 },
      ],
    });

    const { result } = renderHook(() => useAppShellData('2025-03'));
    // CC group: cc-1 (700,000) + dual's CC portion (200,000)
    expect(result.current.ccExecuted).toBe(900_000);
    // Cash group: cash-1 (500,000) + dual's cash portion (100,000)
    expect(result.current.cashExecuted).toBe(600_000);
    // Combined totalExecuted still sums all expenses (ccExecuted + cashExecuted)
    expect(result.current.totalExecuted).toBe(1_500_000);
  });

  it('dual budget expenses do not double-count across groups', () => {
    (useBudgetWithExpenseTotals as Mock).mockReturnValue({
      data: [
        makeBudgetRow({ id: 'dual-1', payment_mode: 'both', bm_id: 'bm-dual', total_expenses: 300_000 }),
      ],
    });
    (useExpenseSumsByModeForMonth as Mock).mockReturnValue({
      data: [
        { budget_month_id: 'bm-dual', paid_with_credit_card: 1, total: 200_000 },
        { budget_month_id: 'bm-dual', paid_with_credit_card: 0, total: 100_000 },
      ],
    });

    const { result } = renderHook(() => useAppShellData('2025-03'));
    // CC expenses land in ccExecuted only
    expect(result.current.ccExecuted).toBe(200_000);
    // Cash expenses land in cashExecuted only — no double-count
    expect(result.current.cashExecuted).toBe(100_000);
  });

  it('availableIncome sums COP income directly', () => {
    (useIncomeMonthAmountsForMonth as Mock).mockReturnValue({
      data: [
        makeIncomeAmountRow(3_000_000, 'COP'),
        makeIncomeAmountRow(2_000_000, 'COP'),
      ],
    });

    const { result } = renderHook(() => useAppShellData('2025-03'));
    expect(result.current.availableIncome).toBe(5_000_000);
  });

  it('availableIncome converts USD income using TRM (Math.round)', () => {
    const trm = 4_200;
    (useIncomeMonthAmountsForMonth as Mock).mockReturnValue({
      data: [
        makeIncomeAmountRow(2_000_000, 'COP'),
        makeIncomeAmountRow(1_000, 'USD'), // 1000 USD * 4200 TRM = 4,200,000 COP
      ],
    });
    (useExchangeRateForMonth as Mock).mockReturnValue({
      data: [{ rate: trm }],
    });

    const { result } = renderHook(() => useAppShellData('2025-03'));
    expect(result.current.availableIncome).toBe(2_000_000 + Math.round(1_000 * trm));
  });

  it('availableIncome excludes USD income when no TRM', () => {
    (useIncomeMonthAmountsForMonth as Mock).mockReturnValue({
      data: [
        makeIncomeAmountRow(2_000_000, 'COP'),
        makeIncomeAmountRow(1_000, 'USD'),
      ],
    });
    (useExchangeRateForMonth as Mock).mockReturnValue({ data: [] });

    const { result } = renderHook(() => useAppShellData('2025-03'));
    expect(result.current.availableIncome).toBe(2_000_000);
  });

  it('budgetedBalance = availableIncome - totalBudgeted', () => {
    (useIncomeMonthAmountsForMonth as Mock).mockReturnValue({
      data: [makeIncomeAmountRow(5_000_000, 'COP')],
    });
    (useBudgetWithExpenseTotals as Mock).mockReturnValue({
      data: [makeBudgetRow({ bm_amount: 3_000_000, total_expenses: 2_500_000 })],
    });

    const { result } = renderHook(() => useAppShellData('2025-03'));
    expect(result.current.budgetedBalance).toBe(5_000_000 - 3_000_000);
  });

  it('realBalance = availableIncome - totalExecuted', () => {
    (useIncomeMonthAmountsForMonth as Mock).mockReturnValue({
      data: [makeIncomeAmountRow(5_000_000, 'COP')],
    });
    (useBudgetWithExpenseTotals as Mock).mockReturnValue({
      data: [makeBudgetRow({ bm_amount: 3_000_000, total_expenses: 2_500_000 })],
    });

    const { result } = renderHook(() => useAppShellData('2025-03'));
    expect(result.current.realBalance).toBe(5_000_000 - 2_500_000);
  });

  it('missingTrm is true when USD income exists and trm is null', () => {
    (useIncomeMonthAmountsForMonth as Mock).mockReturnValue({
      data: [makeIncomeAmountRow(1_000, 'USD')],
    });
    (useExchangeRateForMonth as Mock).mockReturnValue({ data: [] });

    const { result } = renderHook(() => useAppShellData('2025-03'));
    expect(result.current.missingTrm).toBe(true);
  });

  it('missingTrm is false when all income is COP', () => {
    (useIncomeMonthAmountsForMonth as Mock).mockReturnValue({
      data: [makeIncomeAmountRow(5_000_000, 'COP')],
    });
    (useExchangeRateForMonth as Mock).mockReturnValue({ data: [] });

    const { result } = renderHook(() => useAppShellData('2025-03'));
    expect(result.current.missingTrm).toBe(false);
  });

  it('returns all zeros and empty arrays when there is no data', () => {
    const { result } = renderHook(() => useAppShellData('2025-03'));
    expect(result.current.creditCardRows).toEqual([]);
    expect(result.current.cashRows).toEqual([]);
    expect(result.current.availableIncome).toBe(0);
    expect(result.current.totalBudgeted).toBe(0);
    expect(result.current.totalExecuted).toBe(0);
    expect(result.current.budgetedBalance).toBe(0);
    expect(result.current.realBalance).toBe(0);
    expect(result.current.trm).toBeNull();
    expect(result.current.missingTrm).toBe(false);
  });
});
