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
  insertAsset,
  updateAsset,
  softDeleteAsset,
  addAssetValuation,
  deleteAssetValuation,
  type InsertAssetPayload,
} from './PowerSyncAssetRepository';

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

function useTx<T>(tx: T) {
  mockWriteTx.mockImplementation(async (cb: (t: T) => Promise<unknown>) => cb(tx));
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

    const [[, valuation]] = sqlOf(tx.execute, 'INSERT INTO asset_valuations');
    expect(valuation.slice(0, 5)).toEqual([`initial:${id}`, 'hh-1', id, 450_000_000, 'COP']);
    expect(valuation[5]).toMatch(/^\d{4}-\d{2}-\d{2}$/);

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
    await updateAsset('a-1', { kind: 'vehicle' }, 'user-1');

    const [[sql, params]] = sqlOf(mockExecute, 'UPDATE assets');
    expect(sql).toContain('kind = ?');
    expect(sql).not.toContain('name = ?');
    expect(sql).not.toContain('value = ?');
    expect(sql).toContain('last_edited_by = ?');
    expect(params[0]).toBe('vehicle');
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

/**
 * A write transaction for valuations: `asset` is the assets row (null = gone),
 * `active` the asset's active valuations, `latest` what the current value
 * query answers and `initialExists` whether `initial:<id>` was ever written.
 */
function makeValuationTx(opts: {
  asset?: { household_id: string; value: number; currency: string; created_at: string } | null;
  active?: number;
  latest?: { value: number; currency: string } | null;
  initialExists?: boolean;
  valuation?: { asset_id: string } | null;
} = {}) {
  const {
    asset = { household_id: 'hh-1', value: 300_000_000, currency: 'COP', created_at: '2026-01-10T15:00:00.000Z' },
    active = 1,
    latest = { value: 320_000_000, currency: 'COP' },
    initialExists = active > 0,
    valuation = { asset_id: 'a-1' },
  } = opts;
  return {
    execute: vi.fn().mockResolvedValue({}),
    getAll: vi.fn(async () => []),
    getOptional: vi.fn(async (sql: string) => {
      const q = String(sql);
      if (q.includes('FROM assets')) return asset;
      if (q.includes('COUNT(*)')) return { n: active };
      if (q.includes('ORDER BY valued_on DESC')) return latest;
      if (q.includes('WHERE id = ?') && q.includes('deleted_at IS NULL')) return valuation;
      if (q.includes('WHERE id = ?')) return initialExists ? { id: 'initial:a-1' } : null;
      return null;
    }),
  };
}

describe('addAssetValuation', () => {
  const entry = { value: 320_000_000, currency: 'COP' as const, valued_on: '2026-10-01', note: ' Avalúo ' };

  it('adds the valuation and sets the asset to its latest value in one transaction', async () => {
    const tx = makeValuationTx();
    useTx(tx);

    const id = await addAssetValuation('a-1', entry, 'user-1');

    expect(mockExecute).not.toHaveBeenCalled();
    const inserts = sqlOf(tx.execute, 'INSERT INTO asset_valuations');
    expect(inserts).toHaveLength(1);
    expect(inserts[0][1].slice(0, 7)).toEqual([id, 'hh-1', 'a-1', 320_000_000, 'COP', '2026-10-01', 'Avalúo']);

    const [[sql, params]] = sqlOf(tx.execute, 'UPDATE assets');
    expect(sql).toContain('value = ?');
    expect(sql).toContain('last_edited_by = ?');
    expect(params.slice(0, 2)).toEqual([320_000_000, 'COP']);
    expect(params[params.length - 1]).toBe('a-1');
  });

  it('keeps the current value from the latest valuation by date, not the one just written', async () => {
    const tx = makeValuationTx({ latest: { value: 300_000_000, currency: 'COP' } });
    useTx(tx);

    await addAssetValuation('a-1', { ...entry, value: 250_000_000, valued_on: '2024-01-01' }, 'user-1');

    expect(sqlOf(tx.execute, 'UPDATE assets')[0][1].slice(0, 2)).toEqual([300_000_000, 'COP']);
  });

  it('first records the value the asset had when it has no valuations yet', async () => {
    const tx = makeValuationTx({ active: 0, initialExists: false });
    useTx(tx);

    await addAssetValuation('a-1', entry, 'user-1');

    const inserts = sqlOf(tx.execute, 'INSERT INTO asset_valuations');
    expect(inserts).toHaveLength(2);
    expect(inserts[0][1].slice(0, 6)).toEqual(['initial:a-1', 'hh-1', 'a-1', 300_000_000, 'COP', '2026-01-10']);
  });

  it('writes no note for a blank one', async () => {
    const tx = makeValuationTx();
    useTx(tx);

    await addAssetValuation('a-1', { ...entry, note: '  ' }, 'user-1');

    expect(sqlOf(tx.execute, 'INSERT INTO asset_valuations')[0][1][6]).toBeNull();
  });

  it('writes nothing for an asset that no longer exists', async () => {
    const tx = makeValuationTx({ asset: null });
    useTx(tx);

    await expect(addAssetValuation('a-1', entry, 'user-1')).resolves.toBeNull();
    expect(tx.execute).not.toHaveBeenCalled();
  });
});

describe('deleteAssetValuation', () => {
  it('soft deletes the valuation and recomputes the current value', async () => {
    const tx = makeValuationTx({ active: 2, latest: { value: 280_000_000, currency: 'COP' } });
    useTx(tx);

    await deleteAssetValuation('v-2', 'user-1');

    const [[sql, params]] = sqlOf(tx.execute, 'UPDATE asset_valuations');
    expect(sql).toContain('deleted_at = ?');
    expect(params[params.length - 1]).toBe('v-2');
    expect(sqlOf(tx.execute, 'UPDATE assets')[0][1].slice(0, 2)).toEqual([280_000_000, 'COP']);
  });

  it('refuses to delete the only value an asset has', async () => {
    const tx = makeValuationTx({ active: 1 });
    useTx(tx);

    await expect(deleteAssetValuation('v-1', 'user-1')).rejects.toThrow('last valuation');
    expect(tx.execute).not.toHaveBeenCalled();
  });

  it('does nothing for a valuation that is already gone', async () => {
    const tx = makeValuationTx({ valuation: null });
    useTx(tx);

    await deleteAssetValuation('v-1', 'user-1');

    expect(tx.execute).not.toHaveBeenCalled();
  });
});
