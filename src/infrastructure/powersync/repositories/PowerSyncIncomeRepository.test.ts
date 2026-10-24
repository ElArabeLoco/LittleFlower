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
import { insertIncome, updateIncome, type InsertIncomePayload } from './PowerSyncIncomeRepository';

const mockExecute = db.execute as Mock;
const mockWriteTx = db.writeTransaction as Mock;

const payload: InsertIncomePayload = {
  household_id: 'hh-1',
  name: 'Salario',
  person: 'user-1',
  is_fixed: true,
  category: 'Salario',
  default_amount: 5_000_000,
  currency: 'COP',
  start_month: '2026-01',
  created_by: 'user-1',
};

/** A write transaction whose reads answer from the given fixtures. */
function makeTx(opts: { current?: string[]; householdId?: string | null } = {}) {
  const { current = [], householdId = 'hh-1' } = opts;
  return {
    execute: vi.fn().mockResolvedValue({}),
    getAll: vi.fn(async () => current.map(member_id => ({ member_id }))),
    getOptional: vi.fn(async (sql: string, params: unknown[]) => {
      if (String(sql).includes('FROM incomes')) return householdId ? { household_id: householdId } : null;
      if (String(sql).includes('FROM holders')) return null;
      return { id: params[0] };
    }),
  };
}

function useTx(tx: ReturnType<typeof makeTx>) {
  mockWriteTx.mockImplementation(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx));
}

const sqlOf = (fn: Mock, needle: string) =>
  fn.mock.calls.filter(([sql]) => String(sql).includes(needle));

beforeEach(() => {
  vi.clearAllMocks();
  mockExecute.mockResolvedValue({});
});

describe('insertIncome', () => {
  it('writes straight to the database when holders are not given', async () => {
    const id = await insertIncome(payload, 'user-1');

    expect(id).toEqual(expect.any(String));
    expect(sqlOf(mockExecute, 'INSERT INTO incomes')).toHaveLength(1);
    expect(mockWriteTx).not.toHaveBeenCalled();
  });

  it('writes the income and its holders in one transaction', async () => {
    const tx = makeTx();
    useTx(tx);

    const id = await insertIncome(payload, 'user-1', ['m-1', 'm-2']);

    expect(mockWriteTx).toHaveBeenCalledTimes(1);
    expect(mockExecute).not.toHaveBeenCalled();
    expect(sqlOf(tx.execute, 'INSERT INTO incomes')).toHaveLength(1);
    const holders = sqlOf(tx.execute, 'INSERT INTO holders');
    expect(holders.map(([, params]) => params.slice(0, 5))).toEqual([
      [`income:${id}:m-1`, 'hh-1', 'm-1', 'income', id],
      [`income:${id}:m-2`, 'hh-1', 'm-2', 'income', id],
    ]);
  });

  it('opens a transaction for an empty holder list too (nothing to remove on insert)', async () => {
    const tx = makeTx();
    useTx(tx);

    await insertIncome(payload, 'user-1', []);

    expect(sqlOf(tx.execute, 'INSERT INTO incomes')).toHaveLength(1);
    expect(sqlOf(tx.execute, 'holders')).toHaveLength(0);
  });
});

describe('updateIncome', () => {
  it('leaves holders alone when holderIds is undefined', async () => {
    await updateIncome('i-1', { name: 'Nuevo' }, 'user-1');

    expect(sqlOf(mockExecute, 'UPDATE incomes')).toHaveLength(1);
    expect(mockWriteTx).not.toHaveBeenCalled();
  });

  it('does nothing for an empty patch without holders', async () => {
    await updateIncome('i-1', {}, 'user-1');
    expect(mockExecute).not.toHaveBeenCalled();
    expect(mockWriteTx).not.toHaveBeenCalled();
  });

  it('updates the income and its holders in one transaction', async () => {
    const tx = makeTx({ current: ['m-1'] });
    useTx(tx);

    await updateIncome('i-1', { name: 'Nuevo' }, 'user-1', ['m-2']);

    expect(sqlOf(tx.execute, 'UPDATE incomes')).toHaveLength(1);
    expect(sqlOf(tx.execute, 'INSERT INTO holders')).toHaveLength(1);
    expect(sqlOf(tx.execute, 'DELETE FROM holders')[0][1]).toEqual(['income', 'i-1', 'm-1']);
  });

  it('still applies holders when the patch has no fields', async () => {
    const tx = makeTx();
    useTx(tx);

    await updateIncome('i-1', {}, 'user-1', ['m-1']);

    expect(sqlOf(tx.execute, 'UPDATE incomes')).toHaveLength(0);
    expect(sqlOf(tx.execute, 'INSERT INTO holders')).toHaveLength(1);
  });

  it('removes all holders when given an empty list', async () => {
    const tx = makeTx({ current: ['m-1', 'm-2'] });
    useTx(tx);

    await updateIncome('i-1', {}, 'user-1', []);

    expect(sqlOf(tx.execute, 'DELETE FROM holders')).toHaveLength(2);
  });

  it('skips holders for an income that no longer exists', async () => {
    const tx = makeTx({ householdId: null });
    useTx(tx);

    await updateIncome('i-1', {}, 'user-1', ['m-1']);

    expect(tx.execute).not.toHaveBeenCalled();
  });
});
