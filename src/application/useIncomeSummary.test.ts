import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@/infrastructure/powersync/queries/useIncomeQueries', () => ({
  useIncomesForMonth: vi.fn(),
  useIncomeMonthsForMonth: vi.fn(),
}));
vi.mock('@/infrastructure/powersync/queries/useExchangeRateQueries', () => ({
  useExchangeRateForMonth: vi.fn(),
}));

import { useIncomesForMonth, useIncomeMonthsForMonth } from '@/infrastructure/powersync/queries/useIncomeQueries';
import { useExchangeRateForMonth } from '@/infrastructure/powersync/queries/useExchangeRateQueries';
import { useIncomeSummary } from './useIncomeSummary';
import type { IncomeRow, IncomeMonthRow, ExchangeRateRow } from '@/infrastructure/powersync/queries/types';

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

function makeIncomeMonthRow(overrides: Partial<IncomeMonthRow> = {}): IncomeMonthRow {
  return {
    id: 'im-1',
    income_id: 'inc-1',
    month: '2025-03',
    real_amount: 5_200_000,
    currency: 'COP',
    note: null,
    base_salary: 0,
    deductions: 0,
    extra_days: 0,
    ...overrides,
  };
}

function makeRateRow(rate: number): ExchangeRateRow {
  return {
    id: 'rate-1',
    household_id: 'hh-1',
    from_currency: 'USD',
    to_currency: 'COP',
    month: '2025-03',
    rate,
    source: 'manual',
  };
}

describe('useIncomeSummary', () => {
  beforeEach(() => {
    (useIncomesForMonth as Mock).mockReturnValue({ data: [] });
    (useIncomeMonthsForMonth as Mock).mockReturnValue({ data: [] });
    (useExchangeRateForMonth as Mock).mockReturnValue({ data: [] });
  });

  it('returns empty incomes and totalCOP=0 when there is no data', () => {
    const { result } = renderHook(() => useIncomeSummary('2025-03'));
    expect(result.current.incomes).toEqual([]);
    expect(result.current.totalCOP).toBe(0);
  });

  it('imMap maps income_id to IncomeMonthRow correctly', () => {
    const imRow = makeIncomeMonthRow({ income_id: 'inc-1' });
    (useIncomeMonthsForMonth as Mock).mockReturnValue({ data: [imRow] });

    const { result } = renderHook(() => useIncomeSummary('2025-03'));
    expect(result.current.imMap.get('inc-1')).toEqual(imRow);
  });

  it('totalCOP sums COP incomes using real_amount from IncomeMonth override', () => {
    (useIncomesForMonth as Mock).mockReturnValue({ data: [makeIncomeRow()] });
    (useIncomeMonthsForMonth as Mock).mockReturnValue({
      data: [makeIncomeMonthRow({ income_id: 'inc-1', real_amount: 5_200_000, currency: 'COP' })],
    });

    const { result } = renderHook(() => useIncomeSummary('2025-03'));
    expect(result.current.totalCOP).toBe(5_200_000);
  });

  it('totalCOP uses income.default_amount when no IncomeMonth override exists', () => {
    (useIncomesForMonth as Mock).mockReturnValue({
      data: [makeIncomeRow({ default_amount: 5_000_000, currency: 'COP' })],
    });
    (useIncomeMonthsForMonth as Mock).mockReturnValue({ data: [] });

    const { result } = renderHook(() => useIncomeSummary('2025-03'));
    expect(result.current.totalCOP).toBe(5_000_000);
  });

  it('totalCOP converts USD income using TRM (Math.round(amount * trm))', () => {
    const trm = 4_200;
    const usdAmount = 1_000; // in USD
    (useIncomesForMonth as Mock).mockReturnValue({
      data: [makeIncomeRow({ id: 'inc-usd', currency: 'USD', default_amount: usdAmount })],
    });
    (useExchangeRateForMonth as Mock).mockReturnValue({ data: [makeRateRow(trm)] });

    const { result } = renderHook(() => useIncomeSummary('2025-03'));
    expect(result.current.totalCOP).toBe(Math.round(usdAmount * trm)); // 4,200,000
  });

  it('totalCOP excludes USD income when no TRM is available', () => {
    (useIncomesForMonth as Mock).mockReturnValue({
      data: [makeIncomeRow({ currency: 'USD', default_amount: 1_000 })],
    });
    (useExchangeRateForMonth as Mock).mockReturnValue({ data: [] });

    const { result } = renderHook(() => useIncomeSummary('2025-03'));
    expect(result.current.totalCOP).toBe(0);
  });

  it('hasUSDIncome is true when any income has currency !== "COP"', () => {
    (useIncomesForMonth as Mock).mockReturnValue({
      data: [
        makeIncomeRow({ id: 'inc-cop', currency: 'COP' }),
        makeIncomeRow({ id: 'inc-usd', currency: 'USD' }),
      ],
    });

    const { result } = renderHook(() => useIncomeSummary('2025-03'));
    expect(result.current.hasUSDIncome).toBe(true);
  });

  it('hasUSDIncome is false when all incomes are COP', () => {
    (useIncomesForMonth as Mock).mockReturnValue({
      data: [makeIncomeRow({ currency: 'COP' })],
    });

    const { result } = renderHook(() => useIncomeSummary('2025-03'));
    expect(result.current.hasUSDIncome).toBe(false);
  });

  it('missingTrm is true when hasUSDIncome=true and trm=null', () => {
    (useIncomesForMonth as Mock).mockReturnValue({
      data: [makeIncomeRow({ currency: 'USD' })],
    });
    (useExchangeRateForMonth as Mock).mockReturnValue({ data: [] });

    const { result } = renderHook(() => useIncomeSummary('2025-03'));
    expect(result.current.missingTrm).toBe(true);
  });

  it('missingTrm is false when hasUSDIncome=true and trm is available', () => {
    (useIncomesForMonth as Mock).mockReturnValue({
      data: [makeIncomeRow({ currency: 'USD' })],
    });
    (useExchangeRateForMonth as Mock).mockReturnValue({ data: [makeRateRow(4_200)] });

    const { result } = renderHook(() => useIncomeSummary('2025-03'));
    expect(result.current.missingTrm).toBe(false);
  });

  it('missingTrm is false when there is no USD income (even if trm is null)', () => {
    (useIncomesForMonth as Mock).mockReturnValue({
      data: [makeIncomeRow({ currency: 'COP' })],
    });
    (useExchangeRateForMonth as Mock).mockReturnValue({ data: [] });

    const { result } = renderHook(() => useIncomeSummary('2025-03'));
    expect(result.current.missingTrm).toBe(false);
  });

  it('exchangeRate is null when no rate rows', () => {
    (useExchangeRateForMonth as Mock).mockReturnValue({ data: [] });
    const { result } = renderHook(() => useIncomeSummary('2025-03'));
    expect(result.current.exchangeRate).toBeNull();
  });

  it('trm reflects the rate from the first rate row', () => {
    (useExchangeRateForMonth as Mock).mockReturnValue({ data: [makeRateRow(4_350)] });
    const { result } = renderHook(() => useIncomeSummary('2025-03'));
    expect(result.current.trm).toBe(4_350);
  });
});
