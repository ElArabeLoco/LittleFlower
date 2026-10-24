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
import {
  planDebtBackfill,
  applyDebtBackfill,
  insertDebt,
  updateDebt,
  type InsertDebtPayload,
} from './PowerSyncDebtRepository';

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

describe('debt holders', () => {
  const payload: InsertDebtPayload = {
    household_id: 'hh-1',
    name: 'Hipoteca',
    initial_amount: 100_000_000,
    currency: 'COP',
    disbursed_at: '2026-01-01',
    created_by: 'user-1',
  };

  /** A write transaction whose reads answer from the given fixtures. */
  function makeHolderTx(opts: { current?: string[]; householdId?: string | null } = {}) {
    const { current = [], householdId = 'hh-1' } = opts;
    const tx = {
      execute: vi.fn().mockResolvedValue({}),
      getAll: vi.fn(async () => current.map(member_id => ({ member_id }))),
      getOptional: vi.fn(async (sql: string, params: unknown[]) => {
        if (String(sql).includes('FROM debts')) return householdId ? { household_id: householdId } : null;
        if (String(sql).includes('FROM holders')) return null;
        return { id: params[0] };
      }),
    };
    mockWriteTx.mockImplementation(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx));
    return tx;
  }

  const sqlOf = (fn: Mock, needle: string) =>
    fn.mock.calls.filter(([sql]) => String(sql).includes(needle));

  it('insertDebt writes straight to the database without holders', async () => {
    await insertDebt(payload, 'user-1');
    expect(sqlOf(mockExecute, 'INSERT INTO debts')).toHaveLength(1);
    expect(mockWriteTx).not.toHaveBeenCalled();
  });

  it('insertDebt writes the debt and its holders in one transaction', async () => {
    const tx = makeHolderTx();
    const id = await insertDebt(payload, 'user-1', ['m-1', 'm-2']);

    expect(mockExecute).not.toHaveBeenCalled();
    expect(sqlOf(tx.execute, 'INSERT INTO debts')).toHaveLength(1);
    expect(sqlOf(tx.execute, 'INSERT INTO holders').map(([, params]) => params.slice(0, 5))).toEqual([
      [`debt:${id}:m-1`, 'hh-1', 'm-1', 'debt', id],
      [`debt:${id}:m-2`, 'hh-1', 'm-2', 'debt', id],
    ]);
  });

  it('updateDebt leaves holders alone when holderIds is undefined', async () => {
    await updateDebt('d-1', { name: 'Nuevo' }, 'user-1');
    expect(sqlOf(mockExecute, 'UPDATE debts')).toHaveLength(1);
    expect(mockWriteTx).not.toHaveBeenCalled();
  });

  it('updateDebt does nothing for an empty patch without holders', async () => {
    await updateDebt('d-1', {}, 'user-1');
    expect(mockExecute).not.toHaveBeenCalled();
    expect(mockWriteTx).not.toHaveBeenCalled();
  });

  it('updateDebt updates the debt and its holders in one transaction', async () => {
    const tx = makeHolderTx({ current: ['m-1'] });
    await updateDebt('d-1', { name: 'Nuevo' }, 'user-1', ['m-2']);

    expect(sqlOf(tx.execute, 'UPDATE debts')).toHaveLength(1);
    expect(sqlOf(tx.execute, 'INSERT INTO holders')).toHaveLength(1);
    expect(sqlOf(tx.execute, 'DELETE FROM holders')[0][1]).toEqual(['debt', 'd-1', 'm-1']);
  });

  it('updateDebt still applies holders when the patch has no fields', async () => {
    const tx = makeHolderTx({ current: ['m-1'] });
    await updateDebt('d-1', {}, 'user-1', []);

    expect(sqlOf(tx.execute, 'UPDATE debts')).toHaveLength(0);
    expect(sqlOf(tx.execute, 'DELETE FROM holders')).toHaveLength(1);
  });

  it('updateDebt skips holders for a debt that no longer exists', async () => {
    const tx = makeHolderTx({ householdId: null });
    await updateDebt('d-1', {}, 'user-1', ['m-1']);
    expect(tx.execute).not.toHaveBeenCalled();
  });
});
