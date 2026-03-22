import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@/infrastructure/powersync/queries/useDebtQueries', () => ({
  useDebtsQuery: vi.fn(),
  useDebtTransactionsQuery: vi.fn(),
  useDashboardDebtsQuery: vi.fn(),
  useDashboardDebtTxsQuery: vi.fn(),
}));
vi.mock('@/infrastructure/powersync/queries/useExchangeRateQueries', () => ({
  useLatestExchangeRate: vi.fn(),
}));

import {
  useDebtsQuery,
  useDebtTransactionsQuery,
  useDashboardDebtsQuery,
  useDashboardDebtTxsQuery,
} from '@/infrastructure/powersync/queries/useDebtQueries';
import { useLatestExchangeRate } from '@/infrastructure/powersync/queries/useExchangeRateQueries';
import { useDebtManagementSummary, useDashboardDebtSummary } from './useDebtSummary';
import type { DebtRow, DebtTransactionRow } from '@/infrastructure/powersync/queries/types';
import type { DashboardDebtRow } from '@/infrastructure/powersync/queries/useDebtQueries';

function makeDebtRow(overrides: Partial<DebtRow> = {}): DebtRow {
  return {
    id: 'debt-1',
    name: 'Crédito hipotecario',
    description: null,
    initial_amount: 50_000_000,
    currency: 'COP',
    disbursed_at: '2024-01-01',
    household_id: 'hh-1',
    ...overrides,
  };
}

function makeTx(
  type: 'debit' | 'credit',
  amount: number,
  debtId = 'debt-1',
): DebtTransactionRow {
  return {
    id: `tx-${Math.random()}`,
    debt_id: debtId,
    amount,
    original_amount: null,
    original_currency: null,
    exchange_rate: null,
    type,
    note: null,
    date: '2025-03-01',
    source: 'manual',
    expense_id: null,
  };
}

function makeDashDebtRow(overrides: Partial<DashboardDebtRow> = {}): DashboardDebtRow {
  return {
    id: 'debt-1',
    name: 'Crédito hipotecario',
    initial_amount: 50_000_000,
    currency: 'COP',
    ...overrides,
  };
}

describe('useDebtManagementSummary', () => {
  beforeEach(() => {
    (useDebtsQuery as Mock).mockReturnValue({ data: [] });
    (useDebtTransactionsQuery as Mock).mockReturnValue({ data: [] });
    (useLatestExchangeRate as Mock).mockReturnValue({ data: [] });
  });

  it('returns empty debts when no data', () => {
    const { result } = renderHook(() => useDebtManagementSummary());
    expect(result.current.debts).toEqual([]);
    expect(result.current.totalBalance).toBe(0);
    expect(result.current.activeDebts).toEqual([]);
  });

  it('txByDebt correctly groups transactions by debt_id', () => {
    const debt1 = makeDebtRow({ id: 'debt-1' });
    const debt2 = makeDebtRow({ id: 'debt-2' });
    const tx1 = makeTx('debit', 1_000_000, 'debt-1');
    const tx2 = makeTx('credit', 500_000, 'debt-2');
    const tx3 = makeTx('debit', 300_000, 'debt-1');

    (useDebtsQuery as Mock).mockReturnValue({ data: [debt1, debt2] });
    (useDebtTransactionsQuery as Mock).mockReturnValue({ data: [tx1, tx2, tx3] });

    const { result } = renderHook(() => useDebtManagementSummary());
    expect(result.current.txByDebt.get('debt-1')).toHaveLength(2);
    expect(result.current.txByDebt.get('debt-2')).toHaveLength(1);
  });

  it('totalBalance is the sum of balances across all debts (only positive contributions)', () => {
    (useDebtsQuery as Mock).mockReturnValue({
      data: [
        makeDebtRow({ id: 'debt-1', initial_amount: 10_000_000, currency: 'COP' }),
        makeDebtRow({ id: 'debt-2', initial_amount: 5_000_000, currency: 'COP' }),
      ],
    });
    // No transactions — balances are the initial amounts
    const { result } = renderHook(() => useDebtManagementSummary());
    expect(result.current.totalBalance).toBe(15_000_000);
  });

  it('a fully-paid debt (balance <= 0) does not appear in activeDebts', () => {
    (useDebtsQuery as Mock).mockReturnValue({
      data: [makeDebtRow({ id: 'debt-1', initial_amount: 5_000_000, currency: 'COP' })],
    });
    (useDebtTransactionsQuery as Mock).mockReturnValue({
      data: [makeTx('debit', 5_000_000, 'debt-1')], // Fully paid
    });

    const { result } = renderHook(() => useDebtManagementSummary());
    expect(result.current.activeDebts).toHaveLength(0);
  });

  it('a debt with remaining balance appears in activeDebts', () => {
    (useDebtsQuery as Mock).mockReturnValue({
      data: [makeDebtRow({ id: 'debt-1', initial_amount: 5_000_000, currency: 'COP' })],
    });
    (useDebtTransactionsQuery as Mock).mockReturnValue({
      data: [makeTx('debit', 1_000_000, 'debt-1')],
    });

    const { result } = renderHook(() => useDebtManagementSummary());
    expect(result.current.activeDebts).toHaveLength(1);
    expect(result.current.activeDebts[0].id).toBe('debt-1');
  });

  it('COP debt: initial_amount used directly (no conversion)', () => {
    (useDebtsQuery as Mock).mockReturnValue({
      data: [makeDebtRow({ initial_amount: 10_000_000, currency: 'COP' })],
    });
    (useLatestExchangeRate as Mock).mockReturnValue({ data: [] });

    const { result } = renderHook(() => useDebtManagementSummary());
    expect(result.current.totalBalance).toBe(10_000_000);
  });

  it('USD debt: initial_amount converted using currentMonthRate (Math.round)', () => {
    const trm = 4_200;
    (useDebtsQuery as Mock).mockReturnValue({
      data: [makeDebtRow({ initial_amount: 10_000, currency: 'USD' })],
    });
    (useLatestExchangeRate as Mock).mockReturnValue({ data: [{ month: '2025-03', rate: trm }] });

    const { result } = renderHook(() => useDebtManagementSummary());
    expect(result.current.totalBalance).toBe(Math.round(10_000 * trm));
  });

  it('USD debt with no rate: balance = 0 (Math.round(amount * 0))', () => {
    (useDebtsQuery as Mock).mockReturnValue({
      data: [makeDebtRow({ initial_amount: 10_000, currency: 'USD' })],
    });
    (useLatestExchangeRate as Mock).mockReturnValue({ data: [] });

    const { result } = renderHook(() => useDebtManagementSummary());
    expect(result.current.totalBalance).toBe(0);
  });

  it('balance formula: initialCOP + credits - debits (using computeDebtBalance)', () => {
    (useDebtsQuery as Mock).mockReturnValue({
      data: [makeDebtRow({ initial_amount: 10_000_000, currency: 'COP' })],
    });
    (useDebtTransactionsQuery as Mock).mockReturnValue({
      data: [
        makeTx('credit', 1_000_000), // +1M
        makeTx('debit', 3_000_000),  // -3M
      ],
    });

    const { result } = renderHook(() => useDebtManagementSummary());
    // 10M + 1M - 3M = 8M
    expect(result.current.totalBalance).toBe(8_000_000);
  });

  it('totalBalance clips negative balances to 0', () => {
    (useDebtsQuery as Mock).mockReturnValue({
      data: [makeDebtRow({ initial_amount: 5_000_000, currency: 'COP' })],
    });
    (useDebtTransactionsQuery as Mock).mockReturnValue({
      data: [makeTx('debit', 10_000_000)], // Overpaid
    });

    const { result } = renderHook(() => useDebtManagementSummary());
    expect(result.current.totalBalance).toBe(0); // Math.max(0, -5M) = 0
  });
});

describe('useDashboardDebtSummary', () => {
  beforeEach(() => {
    (useDashboardDebtsQuery as Mock).mockReturnValue({ data: [] });
    (useDashboardDebtTxsQuery as Mock).mockReturnValue({ data: [] });
    (useLatestExchangeRate as Mock).mockReturnValue({ data: [] });
  });

  it('debtInitialCOP returns debt.initial_amount for COP debts', () => {
    (useDashboardDebtsQuery as Mock).mockReturnValue({
      data: [makeDashDebtRow({ initial_amount: 50_000_000, currency: 'COP' })],
    });

    const { result } = renderHook(() => useDashboardDebtSummary());
    const debt = result.current.dashDebts[0];
    expect(result.current.debtInitialCOP(debt)).toBe(50_000_000);
  });

  it('debtInitialCOP returns Math.round(initial_amount * latestTrm) for USD debts', () => {
    const trm = 4_200;
    (useDashboardDebtsQuery as Mock).mockReturnValue({
      data: [makeDashDebtRow({ initial_amount: 10_000, currency: 'USD' })],
    });
    (useLatestExchangeRate as Mock).mockReturnValue({ data: [{ rate: trm }] });

    const { result } = renderHook(() => useDashboardDebtSummary());
    const debt = result.current.dashDebts[0];
    expect(result.current.debtInitialCOP(debt)).toBe(Math.round(10_000 * trm));
  });

  it('debtInitialCOP returns 0 when USD debt and no latestTrm', () => {
    (useDashboardDebtsQuery as Mock).mockReturnValue({
      data: [makeDashDebtRow({ initial_amount: 10_000, currency: 'USD' })],
    });
    (useLatestExchangeRate as Mock).mockReturnValue({ data: [] });

    const { result } = renderHook(() => useDashboardDebtSummary());
    const debt = result.current.dashDebts[0];
    expect(result.current.debtInitialCOP(debt)).toBe(0);
  });
});
