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
import { insertAsset, updateAsset, softDeleteAsset, type InsertAssetPayload } from './PowerSyncAssetRepository';

const mockExecute = db.execute as Mock;
const mockWriteTx = db.writeTransaction as Mock;

const payload: InsertAssetPayload = {
  household_id: 'hh-1',
  name: '  Apartamento Chapinero ',
  kind: 'real_estate',
  value: 450_000_000,
  currency: 'COP',
  created_by: 'user-1',
};

/** A write transaction whose reads answer from the given fixtures. */
function makeTx(opts: { current?: string[]; householdId?: string | null } = {}) {
  const { current = [], householdId = 'hh-1' } = opts;
  return {
    execute: vi.fn().mockResolvedValue({}),
    getAll: vi.fn(async () => current.map(member_id => ({ member_id }))),
    getOptional: vi.fn(async (sql: string, params: unknown[]) => {
      if (String(sql).includes('FROM assets')) return householdId ? { household_id: householdId } : null;
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

describe('insertAsset', () => {
  it('writes the asset with authorship and its holders in one transaction', async () => {
    const tx = makeTx();
    useTx(tx);

    const id = await insertAsset(payload, 'user-1', ['m-1', 'm-2']);

    expect(id).toEqual(expect.any(String));
    expect(mockExecute).not.toHaveBeenCalled();
    const [[, params]] = sqlOf(tx.execute, 'INSERT INTO assets');
    const [rowId, householdId, name, kind, value, currency, createdBy, createdAt, updatedAt, editedBy] = params;
    expect([rowId, householdId, name, kind, value, currency, createdBy]).toEqual([
      id, 'hh-1', 'Apartamento Chapinero', 'real_estate', 450_000_000, 'COP', 'user-1',
    ]);
    expect(updatedAt).toBe(createdAt);
    expect(editedBy).toBe('user-1');

    const holders = sqlOf(tx.execute, 'INSERT INTO holders');
    expect(holders.map(([, p]) => p.slice(0, 5))).toEqual([
      [`asset:${id}:m-1`, 'hh-1', 'm-1', 'asset', id],
      [`asset:${id}:m-2`, 'hh-1', 'm-2', 'asset', id],
    ]);
  });

  it('writes no holder rows for a household asset', async () => {
    const tx = makeTx();
    useTx(tx);

    await insertAsset(payload, 'user-1', []);

    expect(sqlOf(tx.execute, 'INSERT INTO assets')).toHaveLength(1);
    expect(sqlOf(tx.execute, 'holders')).toHaveLength(0);
  });

  it('refuses to write before the session is ready', async () => {
    await expect(
      insertAsset({ ...payload, household_id: '', created_by: '' }, '', []),
    ).rejects.toThrow('empty auth');
    expect(mockWriteTx).not.toHaveBeenCalled();
  });
});

describe('updateAsset', () => {
  it('updates only the given fields and stamps the edit', async () => {
    await updateAsset('a-1', { value: 470_000_000 }, 'user-1');

    const [[sql, params]] = sqlOf(mockExecute, 'UPDATE assets');
    expect(sql).toContain('value = ?');
    expect(sql).not.toContain('name = ?');
    expect(sql).toContain('last_edited_by = ?');
    expect(params[0]).toBe(470_000_000);
    expect(params[params.length - 1]).toBe('a-1');
    expect(mockWriteTx).not.toHaveBeenCalled();
  });

  it('trims the name', async () => {
    await updateAsset('a-1', { name: ' Carro ' }, 'user-1');
    expect(sqlOf(mockExecute, 'UPDATE assets')[0][1][0]).toBe('Carro');
  });

  it('does nothing for an empty patch without holders', async () => {
    await updateAsset('a-1', {}, 'user-1');
    expect(mockExecute).not.toHaveBeenCalled();
    expect(mockWriteTx).not.toHaveBeenCalled();
  });

  it('updates the asset and its holders in one transaction', async () => {
    const tx = makeTx({ current: ['m-1'] });
    useTx(tx);

    await updateAsset('a-1', { name: 'CDT' }, 'user-1', ['m-2']);

    expect(sqlOf(tx.execute, 'UPDATE assets')).toHaveLength(1);
    expect(sqlOf(tx.execute, 'INSERT INTO holders')).toHaveLength(1);
    expect(sqlOf(tx.execute, 'DELETE FROM holders')[0][1]).toEqual(['asset', 'a-1', 'm-1']);
  });

  it('still applies holders when the patch has no fields', async () => {
    const tx = makeTx();
    useTx(tx);

    await updateAsset('a-1', {}, 'user-1', ['m-1']);

    expect(sqlOf(tx.execute, 'UPDATE assets')).toHaveLength(0);
    expect(sqlOf(tx.execute, 'INSERT INTO holders')).toHaveLength(1);
  });

  it('skips holders for an asset that no longer exists', async () => {
    const tx = makeTx({ householdId: null });
    useTx(tx);

    await updateAsset('a-1', {}, 'user-1', ['m-1']);

    expect(tx.execute).not.toHaveBeenCalled();
  });
});

describe('softDeleteAsset', () => {
  it('sets deleted_at and stamps the edit, keeping holder rows', async () => {
    await softDeleteAsset('a-1', 'user-1');

    const [[sql, params]] = sqlOf(mockExecute, 'UPDATE assets');
    expect(sql).toContain('deleted_at = ?');
    expect(params).toContain('user-1');
    expect(params[params.length - 1]).toBe('a-1');
    expect(sqlOf(mockExecute, 'holders')).toHaveLength(0);
  });
});
