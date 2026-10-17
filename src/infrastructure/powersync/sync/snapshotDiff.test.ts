import { describe, it, expect } from 'vitest';
import { diffSnapshots, fnv1a32, snapshotFromRows } from './snapshotDiff';

const NONE = new Set<string>();

const budget = (overrides: Record<string, unknown> = {}) => ({
  id: 'b-1',
  name: 'Arriendo',
  default_amount: 1_500_000,
  deleted_at: null,
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

/** The fields a snapshot keeps for a budget row (what describeRow reads). */
const kept = (overrides: Record<string, unknown> = {}) => ({
  name: 'Arriendo',
  default_amount: 1_500_000,
  deleted_at: null,
  ...overrides,
});

describe('fnv1a32()', () => {
  it.each([
    ['', '811c9dc5'],
    ['a', 'e40c292c'],
    ['foobar', 'bf9cf968'],
  ])('hashes %j to %s (FNV-1a test vectors)', (text, hash) => {
    expect(fnv1a32(text)).toBe(hash);
  });
});

describe('snapshotFromRows()', () => {
  it('keeps a short signature and only the fields needed to describe the row', () => {
    const entry = snapshotFromRows([budget()]).get('b-1');

    expect(entry?.signature).toMatch(/^[0-9a-f]{8}$/);
    expect(entry?.fields).toEqual(kept());
  });

  it('has a key-order independent signature', () => {
    const a = snapshotFromRows([{ id: 'b-1', name: 'Arriendo', amount: 1 }]);
    const b = snapshotFromRows([{ amount: 1, name: 'Arriendo', id: 'b-1' }]);

    expect(a.get('b-1')?.signature).toBe(b.get('b-1')?.signature);
  });

  it('changes the signature when any column changes, kept or not', () => {
    const base = snapshotFromRows([budget()]).get('b-1')?.signature;

    expect(snapshotFromRows([budget({ default_amount: 1_600_000 })]).get('b-1')?.signature).not.toBe(base);
    expect(snapshotFromRows([budget({ created_by: 'user-2' })]).get('b-1')?.signature).not.toBe(base);
  });

  it('skips rows without a string id', () => {
    const snapshot = snapshotFromRows([{ id: 7, name: 'x' }, { name: 'no id' }, { id: '', name: 'empty' }, budget()]);

    expect([...snapshot.keys()]).toEqual(['b-1']);
  });
});

describe('diffSnapshots()', () => {
  it('reports created rows with their fields', () => {
    const diff = diffSnapshots(snapshotFromRows([]), snapshotFromRows([budget()]), NONE);

    expect(diff).toEqual([{ op: 'create', id: 'b-1', fields: kept(), previous: null }]);
  });

  it('reports updated rows with the previous fields', () => {
    const diff = diffSnapshots(
      snapshotFromRows([budget()]),
      snapshotFromRows([budget({ default_amount: 1_600_000 })]),
      NONE,
    );

    expect(diff).toEqual([{ op: 'update', id: 'b-1', fields: kept({ default_amount: 1_600_000 }), previous: kept() }]);
  });

  it('reports a change in a column it does not keep', () => {
    const diff = diffSnapshots(snapshotFromRows([budget()]), snapshotFromRows([budget({ created_by: 'user-2' })]), NONE);

    expect(diff.map((d) => d.op)).toEqual(['update']);
  });

  it('ignores unchanged rows', () => {
    expect(diffSnapshots(snapshotFromRows([budget()]), snapshotFromRows([budget()]), NONE)).toEqual([]);
  });

  it('reports removed rows as deletes described by their last kept fields', () => {
    const diff = diffSnapshots(snapshotFromRows([budget()]), snapshotFromRows([]), NONE);

    expect(diff).toEqual([{ op: 'delete', id: 'b-1', fields: kept(), previous: kept() }]);
  });

  it('treats setting a previously empty deleted_at as a delete', () => {
    const deletedAt = '2026-03-01T10:00:00Z';

    const diff = diffSnapshots(snapshotFromRows([budget()]), snapshotFromRows([budget({ deleted_at: deletedAt })]), NONE);

    expect(diff).toEqual([{ op: 'delete', id: 'b-1', fields: kept({ deleted_at: deletedAt }), previous: kept() }]);
  });

  it('treats other changes to soft-deleted rows, and restores, as updates', () => {
    const deleted = budget({ deleted_at: '2026-03-01T10:00:00Z' });
    const redeleted = budget({ deleted_at: '2026-03-02T10:00:00Z' });

    expect(diffSnapshots(snapshotFromRows([deleted]), snapshotFromRows([redeleted]), NONE)[0].op).toBe('update');
    expect(diffSnapshots(snapshotFromRows([deleted]), snapshotFromRows([budget()]), NONE)[0].op).toBe('update');
  });

  it('skips excluded ids for every kind of change', () => {
    const prev = snapshotFromRows([budget({ id: 'gone' }), budget({ id: 'edited' })]);
    const next = snapshotFromRows([budget({ id: 'edited', name: 'Renta' }), budget({ id: 'new' })]);

    expect(diffSnapshots(prev, next, new Set(['gone', 'edited', 'new']))).toEqual([]);
    expect(diffSnapshots(prev, next, new Set(['gone'])).map((d) => `${d.op}:${d.id}`)).toEqual([
      'update:edited',
      'create:new',
    ]);
  });
});
