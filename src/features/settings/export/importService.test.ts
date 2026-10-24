import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/infrastructure/powersync/client', () => ({
  db: { getAll: vi.fn(), execute: vi.fn() },
}));

import { db } from '@/infrastructure/powersync/client';
import { importFromLF } from './importService';

const mockExecute = db.execute as Mock;

function backupFile(data: Record<string, unknown>): File {
  const json = JSON.stringify({ _format: 'florecita-backup', _v: 1, _household_id: 'hh-1', ...data });
  return { text: async () => json } as unknown as File;
}

/** Column → value of the INSERT written for `table`. */
function inserted(table: string): Record<string, unknown> {
  const call = mockExecute.mock.calls.find(([sql]) => String(sql).startsWith(`INSERT INTO ${table} `));
  if (!call) throw new Error(`no insert into ${table}`);
  const cols = String(call[0]).match(/\(([^)]+)\)/)![1].split(', ');
  return Object.fromEntries(cols.map((c, i) => [c, (call[1] as unknown[])[i]]));
}

beforeEach(() => {
  vi.clearAllMocks();
  (db.getAll as Mock).mockResolvedValue([]);
  mockExecute.mockResolvedValue({});
});

describe('importFromLF — debts from backups that predate loan terms', () => {
  it('fills the loan-term defaults instead of NULL', async () => {
    await importFromLF(backupFile({
      debts: [{ id: 'd1', name: 'Préstamo', initial_amount: 1_000_000, currency: 'COP', disbursed_at: '2025-01-01' }],
      debt_transactions: [{ id: 't1', debt_id: 'd1', amount: 100_000, type: 'debit', date: '2025-02-01', source: 'manual' }],
    }), 'hh-1');

    expect(inserted('debts')).toMatchObject({
      kind: 'personal', interest_rate: 0, amortization: 'none', monthly_fees: 0, lender: null,
    });
    expect(inserted('debt_transactions')).toMatchObject({ interest_amount: 0, fees_amount: 0 });
  });

  it('keeps loan terms present in the backup', async () => {
    await importFromLF(backupFile({
      debts: [{
        id: 'd1', name: 'Hipoteca', initial_amount: 200_000_000, currency: 'COP', disbursed_at: '2026-01-01',
        kind: 'mortgage', interest_rate: 0.12, amortization: 'fixed_installment', term_months: 240, monthly_fees: 185_000,
      }],
    }), 'hh-1');

    expect(inserted('debts')).toMatchObject({
      kind: 'mortgage', interest_rate: 0.12, amortization: 'fixed_installment', term_months: 240, monthly_fees: 185_000,
    });
  });
});

/** Every INSERT written for `table`: column → value. */
function insertedAll(table: string): Record<string, unknown>[] {
  return mockExecute.mock.calls
    .filter(([sql]) => String(sql).startsWith(`INSERT INTO ${table} `))
    .map(([sql, params]) => {
      const cols = String(sql).match(/\(([^)]+)\)/)![1].split(', ');
      return Object.fromEntries(cols.map((c, i) => [c, (params as unknown[])[i]]));
    });
}

/** Makes the local tables answer id lookups, e.g. { household_members: ['m-local'] }. */
function localRows(tables: Record<string, string[]>) {
  (db.getAll as Mock).mockImplementation(async (sql: string, params: unknown[] = []) => {
    const table = /FROM (\w+)/.exec(String(sql))?.[1] ?? '';
    const known = tables[table] ?? [];
    return params.filter(id => known.includes(id as string)).map(id => ({ id }));
  });
}

const member = {
  id: 'm1', household_id: 'old-hh', name: 'Sofía', tone: 'iris',
  created_by: 'u1', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  last_edited_by: 'u1', last_edited_at: '2026-01-01T00:00:00Z', deleted_at: null,
};

describe('importFromLF — members and holders', () => {
  it('still imports a backup without the new arrays', async () => {
    const result = await importFromLF(backupFile({
      incomes: [{ id: 'i1', name: 'Salario', person: 'u1', category: 'Salario', default_amount: 1, currency: 'COP', start_month: '2026-01', created_by: 'u1', created_at: 'x' }],
    }), 'hh-1');

    expect(result.errors).toEqual([]);
    expect(result.imported).toBe(1);
    expect(insertedAll('household_members')).toEqual([]);
    expect(insertedAll('holders')).toEqual([]);
  });

  it('imports members and holders into the current household', async () => {
    const result = await importFromLF(backupFile({
      incomes: [{ id: 'i1', name: 'Salario', person: 'u1', category: 'Salario', default_amount: 1, currency: 'COP', start_month: '2026-01', created_by: 'u1', created_at: 'x' }],
      debts: [{ id: 'd1', name: 'Hipoteca', initial_amount: 1, currency: 'COP', disbursed_at: '2026-01-01' }],
      household_members: [member],
      holders: [
        { id: 'income:i1:m1', household_id: 'old-hh', member_id: 'm1', subject_type: 'income', subject_id: 'i1', created_by: 'u1', created_at: 'x' },
        { id: 'debt:d1:m1', household_id: 'old-hh', member_id: 'm1', subject_type: 'debt', subject_id: 'd1', created_by: 'u1', created_at: 'x' },
      ],
    }), 'hh-1');

    expect(result.errors).toEqual([]);
    expect(insertedAll('household_members')).toEqual([
      expect.objectContaining({ id: 'm1', household_id: 'hh-1', name: 'Sofía', tone: 'iris', deleted_at: null }),
    ]);
    expect(insertedAll('holders')).toEqual([
      expect.objectContaining({ id: 'income:i1:m1', household_id: 'hh-1', member_id: 'm1', subject_type: 'income', subject_id: 'i1' }),
      expect.objectContaining({ id: 'debt:d1:m1', household_id: 'hh-1', member_id: 'm1', subject_type: 'debt', subject_id: 'd1' }),
    ]);
    expect(result.imported).toBe(5);
    expect(result.skipped).toBe(0);
  });

  it('writes members before holders and after incomes and debts', async () => {
    await importFromLF(backupFile({
      incomes: [{ id: 'i1', name: 'Salario' }],
      household_members: [member],
      holders: [{ id: 'income:i1:m1', member_id: 'm1', subject_type: 'income', subject_id: 'i1', created_by: 'u1', created_at: 'x' }],
    }), 'hh-1');

    const tables = mockExecute.mock.calls.map(([sql]) => /INSERT INTO (\w+)/.exec(String(sql))![1]);
    expect(tables).toEqual(['incomes', 'household_members', 'holders']);
  });

  it('defaults an unknown tone to petal', async () => {
    await importFromLF(backupFile({ household_members: [{ ...member, tone: undefined }] }), 'hh-1');

    expect(insertedAll('household_members')[0]).toMatchObject({ tone: 'petal' });
  });

  it('skips holders whose member exists neither in the file nor locally', async () => {
    const result = await importFromLF(backupFile({
      incomes: [{ id: 'i1', name: 'Salario' }],
      holders: [{ id: 'income:i1:ghost', member_id: 'ghost', subject_type: 'income', subject_id: 'i1', created_by: 'u1', created_at: 'x' }],
    }), 'hh-1');

    expect(insertedAll('holders')).toEqual([]);
    expect(result.skipped).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it('skips holders whose income or debt exists neither in the file nor locally', async () => {
    const result = await importFromLF(backupFile({
      household_members: [member],
      holders: [
        { id: 'income:i404:m1', member_id: 'm1', subject_type: 'income', subject_id: 'i404', created_by: 'u1', created_at: 'x' },
        { id: 'debt:d404:m1', member_id: 'm1', subject_type: 'debt', subject_id: 'd404', created_by: 'u1', created_at: 'x' },
      ],
    }), 'hh-1');

    expect(insertedAll('holders')).toEqual([]);
    expect(result.skipped).toBe(2);
  });

  it('skips holders of an unknown subject type', async () => {
    const result = await importFromLF(backupFile({
      household_members: [member],
      holders: [{ id: 'budget:b1:m1', member_id: 'm1', subject_type: 'budget', subject_id: 'b1', created_by: 'u1', created_at: 'x' }],
    }), 'hh-1');

    expect(insertedAll('holders')).toEqual([]);
    expect(result.skipped).toBe(1);
  });

  it('imports assets with their holders, assets before holders', async () => {
    const result = await importFromLF(backupFile({
      household_members: [member],
      assets: [{
        id: 'a1', household_id: 'old-hh', name: 'Apartamento', kind: 'real_estate', value: 450_000_000, currency: 'COP',
        created_by: 'u1', created_at: 'x', updated_at: 'x',
      }],
      holders: [{ id: 'asset:a1:m1', member_id: 'm1', subject_type: 'asset', subject_id: 'a1', created_by: 'u1', created_at: 'x' }],
    }), 'hh-1');

    expect(inserted('assets')).toMatchObject({ id: 'a1', household_id: 'hh-1', value: 450_000_000, kind: 'real_estate' });
    expect(insertedAll('holders')).toHaveLength(1);
    const tables = mockExecute.mock.calls.map(([sql]) => /INSERT INTO (\w+)/.exec(String(sql))?.[1]);
    expect(tables.indexOf('assets')).toBeLessThan(tables.indexOf('holders'));
    expect(result.skipped).toBe(0);
  });

  it('fills asset defaults for missing NOT NULL columns', async () => {
    await importFromLF(backupFile({
      assets: [{ id: 'a1', name: 'Carro', created_by: 'u1', created_at: 'x', updated_at: 'x' }],
    }), 'hh-1');

    expect(inserted('assets')).toMatchObject({ kind: 'other', value: 0, currency: 'COP' });
  });

  it('skips holders whose asset exists neither in the file nor locally', async () => {
    const result = await importFromLF(backupFile({
      household_members: [member],
      holders: [{ id: 'asset:a404:m1', member_id: 'm1', subject_type: 'asset', subject_id: 'a404', created_by: 'u1', created_at: 'x' }],
    }), 'hh-1');

    expect(insertedAll('holders')).toEqual([]);
    expect(result.skipped).toBe(1);
  });

  it('keeps holders whose member and subject already exist locally', async () => {
    localRows({ household_members: ['m-local'], incomes: ['i-local'] });

    const result = await importFromLF(backupFile({
      holders: [{ id: 'income:i-local:m-local', member_id: 'm-local', subject_type: 'income', subject_id: 'i-local', created_by: 'u1', created_at: 'x' }],
    }), 'hh-1');

    expect(insertedAll('holders')).toHaveLength(1);
    expect(result.skipped).toBe(0);
  });

  it('skips a holder row that already exists, like any other row', async () => {
    localRows({ household_members: ['m1'], incomes: ['i1'], holders: ['income:i1:m1'] });

    const result = await importFromLF(backupFile({
      holders: [{ id: 'income:i1:m1', member_id: 'm1', subject_type: 'income', subject_id: 'i1', created_by: 'u1', created_at: 'x' }],
    }), 'hh-1');

    expect(insertedAll('holders')).toEqual([]);
    expect(result.skipped).toBe(1);
  });
});
