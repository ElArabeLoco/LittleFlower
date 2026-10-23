import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/infrastructure/powersync/client', () => ({
  db: {
    execute: vi.fn(),
    getOptional: vi.fn(),
    getAll: vi.fn(),
    writeTransaction: vi.fn(),
  },
}));

import { db } from '@/infrastructure/powersync/client';
import { planDebtBackfill, applyDebtBackfill } from './PowerSyncDebtRepository';

const mockGet = db.getOptional as Mock;
const mockGetAll = db.getAll as Mock;
const mockExecute = db.execute as Mock;
const mockWriteTx = db.writeTransaction as Mock;

/** E.A. equivalent to exactly 1% per month. */
const EA_1PCT_MONTHLY = Math.pow(1.01, 12) - 1;

const debtRow = {
  currency: 'COP',
  initial_amount: 10_000_000,
  interest_rate: EA_1PCT_MONTHLY,
  amortization: 'fixed_installment',
  term_months: 12,
  installment_amount: null,
  monthly_fees: 50_000,
  disbursed_at: '2026-01-01',
};

const expenseRows = [
  { expense_id: 'e-feb', date: '2026-02-15', total: 938_488, note: null },
  { expense_id: 'e-jan', date: '2026-01-15', total: 938_488, note: 'Cuota enero' },
];

/** getAll answers by table: past expenses or debt movements. */
function answerGetAll(expenses: unknown[], movements: unknown[] = []) {
  return async (sql: string) => (String(sql).includes('FROM expenses') ? expenses : movements);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue(debtRow);
  mockGetAll.mockImplementation(answerGetAll(expenseRows));
  mockExecute.mockResolvedValue({});
});

describe('planDebtBackfill', () => {
  it('splits the budget expenses dated from the debt start, in date order', async () => {
    const entries = await planDebtBackfill('budget-1', 'debt-1');
    expect(entries.map(e => [e.expenseId, e.principal, e.interest, e.fees])).toEqual([
      ['e-jan', 788_488, 100_000, 50_000],
      ['e-feb', 796_373, 92_115, 50_000],
    ]);
    const expenseQuery = mockGetAll.mock.calls.find(([sql]) => String(sql).includes('FROM expenses'));
    expect(expenseQuery![1]).toEqual(['budget-1', '2026-01-01', 'debt-1']);
  });

  it('plans nothing for a debt that no longer exists', async () => {
    mockGet.mockResolvedValue(null);
    expect(await planDebtBackfill('budget-1', 'debt-1')).toEqual([]);
  });

  it('applies payments on debts in other currencies straight to principal', async () => {
    mockGet.mockResolvedValue({ ...debtRow, currency: 'USD' });
    const entries = await planDebtBackfill('budget-1', 'debt-1');
    expect(entries.every(e => e.interest === 0 && e.fees === 0 && e.principal === e.total)).toBe(true);
  });
});

describe('applyDebtBackfill', () => {
  it('records one debit per planned payment inside a single write', async () => {
    const tx = { execute: vi.fn().mockResolvedValue({}), getOptional: mockGet, getAll: mockGetAll };
    mockWriteTx.mockImplementation(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx));

    expect(await applyDebtBackfill('hh-1', 'budget-1', 'debt-1', 'user-1')).toBe(2);

    expect(mockExecute).not.toHaveBeenCalled();
    const inserts = tx.execute.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO debt_transactions'));
    expect(inserts).toHaveLength(2);
    const [, params] = inserts[0];
    expect(params).toEqual(expect.arrayContaining([
      'hh-1', 'debt-1', 788_488, 100_000, 50_000, 'debit', 'Cuota enero', '2026-01-15', 'expense', 'e-jan', 'user-1',
    ]));
  });
});
