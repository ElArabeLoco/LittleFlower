import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/infrastructure/powersync/client', () => ({
  db: {
    execute: vi.fn(),
    getOptional: vi.fn(),
    getAll: vi.fn(),
  },
}));

import { db } from '@/infrastructure/powersync/client';
import { recordExpense, softDeleteExpense, type RecordExpensePayload } from './PowerSyncExpenseRepository';

const mockExecute = db.execute as Mock;
const mockGet = db.getOptional as Mock;

/** E.A. equivalent to exactly 1% per month. */
const EA_1PCT_MONTHLY = Math.pow(1.01, 12) - 1;

function payload(overrides: Partial<RecordExpensePayload> = {}): RecordExpensePayload {
  return {
    household_id: 'hh-1',
    budget_id: 'budget-1',
    budget_month_id: 'bm-1',
    amount: 938_488,
    recorded_by: 'user-1',
    timestamp: '2026-10-05T12:00:00.000Z',
    paid_with_credit_card: false,
    debt_id: 'debt-1',
    ...overrides,
  };
}

function debtTermsRow(overrides: Record<string, unknown> = {}) {
  return {
    currency: 'COP',
    initial_amount: 10_000_000,
    interest_rate: EA_1PCT_MONTHLY,
    amortization: 'fixed_installment',
    term_months: 12,
    installment_amount: null,
    monthly_fees: 50_000,
    delta: 0,
    ...overrides,
  };
}

/** [principal, interest, fees] written to the debt transaction. */
function insertedDebtSplit(): [number, number, number] {
  const call = mockExecute.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO debt_transactions'));
  if (!call) throw new Error('no debt transaction inserted');
  const params = call[1] as unknown[];
  return [params[3], params[4], params[5]] as [number, number, number];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockExecute.mockResolvedValue({});
});

describe('recordExpense — debt-linked budgets', () => {
  it('a personal debt receives the whole payment as principal', async () => {
    mockGet.mockResolvedValue(debtTermsRow({ interest_rate: 0, monthly_fees: 0, amortization: 'none' }));
    await recordExpense(payload({ amount: 500_000 }));
    expect(insertedDebtSplit()).toEqual([500_000, 0, 0]);
  });

  it('a financial debt splits the payment from its balance and rate', async () => {
    mockGet.mockResolvedValue(debtTermsRow());
    await recordExpense(payload());
    expect(insertedDebtSplit()).toEqual([788_488, 100_000, 50_000]);
  });

  it('accrues interest on the balance after previous payments', async () => {
    mockGet.mockResolvedValue(debtTermsRow({ delta: -5_000_000, monthly_fees: 0 }));
    await recordExpense(payload({ amount: 888_488 }));
    expect(insertedDebtSplit()).toEqual([838_488, 50_000, 0]);
  });

  it('uses the split given by the user', async () => {
    await recordExpense(payload({ debt_split: { principal: 800_000, interest: 98_488, fees: 40_000 } }));
    expect(mockGet).not.toHaveBeenCalled();
    expect(insertedDebtSplit()).toEqual([800_000, 98_488, 40_000]);
  });

  it('rejects a split that does not add up, before writing anything', async () => {
    await expect(
      recordExpense(payload({ debt_split: { principal: 1, interest: 1, fees: 1 } })),
    ).rejects.toThrow();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('does not touch debts for budgets without a debt', async () => {
    await recordExpense(payload({ debt_id: undefined }));
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });
});

describe('softDeleteExpense', () => {
  it('also removes the debt transaction created from the expense', async () => {
    await softDeleteExpense('exp-1');
    const debtCall = mockExecute.mock.calls.find(([sql]) => String(sql).includes('UPDATE debt_transactions'));
    expect(debtCall).toBeDefined();
    expect(String(debtCall![0])).toContain('expense_id = ?');
    expect(debtCall![1]).toContain('exp-1');
  });
});
