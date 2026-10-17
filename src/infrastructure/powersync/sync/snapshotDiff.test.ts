import { describe, it, expect } from 'vitest';
import { diffSnapshots, snapshotFromRows } from './snapshotDiff';

const NONE = new Set<string>();

const budget = (overrides: Record<string, unknown> = {}) => ({
  id: 'b-1',
  name: 'Arriendo',
  default_amount: 1_500_000,
  deleted_at: null,
  ...overrides,
});

describe('snapshotFromRows()', () => {
  it('indexes rows by id with a key-order independent signature', () => {
    const a = snapshotFromRows([{ id: 'b-1', name: 'Arriendo', amount: 1 }]);
    const b = snapshotFromRows([{ amount: 1, name: 'Arriendo', id: 'b-1' }]);

    expect(a.get('b-1')?.signature).toBe(b.get('b-1')?.signature);
    expect(a.get('b-1')?.row).toEqual({ id: 'b-1', name: 'Arriendo', amount: 1 });
  });

  it('changes the signature when a value changes', () => {
    const a = snapshotFromRows([budget()]);
    const b = snapshotFromRows([budget({ default_amount: 1_600_000 })]);

    expect(a.get('b-1')?.signature).not.toBe(b.get('b-1')?.signature);
  });

  it('skips rows without a string id', () => {
    const snapshot = snapshotFromRows([{ id: 7, name: 'x' }, { name: 'no id' }, { id: '', name: 'empty' }, budget()]);

    expect([...snapshot.keys()]).toEqual(['b-1']);
  });
});

describe('diffSnapshots()', () => {
  it('reports created rows with their data', () => {
    const diff = diffSnapshots(snapshotFromRows([]), snapshotFromRows([budget()]), NONE);

    expect(diff).toEqual([{ op: 'create', id: 'b-1', row: budget(), previous: null }]);
  });

  it('reports updated rows with the previous version', () => {
    const before = budget();
    const after = budget({ default_amount: 1_600_000 });

    const diff = diffSnapshots(snapshotFromRows([before]), snapshotFromRows([after]), NONE);

    expect(diff).toEqual([{ op: 'update', id: 'b-1', row: after, previous: before }]);
  });

  it('ignores unchanged rows', () => {
    expect(diffSnapshots(snapshotFromRows([budget()]), snapshotFromRows([budget()]), NONE)).toEqual([]);
  });

  it('reports removed rows as deletes described by their last known data', () => {
    const diff = diffSnapshots(snapshotFromRows([budget()]), snapshotFromRows([]), NONE);

    expect(diff).toEqual([{ op: 'delete', id: 'b-1', row: budget(), previous: budget() }]);
  });

  it('treats setting a previously empty deleted_at as a delete', () => {
    const after = budget({ deleted_at: '2026-03-01T10:00:00Z' });

    const diff = diffSnapshots(snapshotFromRows([budget()]), snapshotFromRows([after]), NONE);

    expect(diff).toEqual([{ op: 'delete', id: 'b-1', row: after, previous: budget() }]);
  });

  it('treats a soft delete of a row without a deleted_at column value as a delete', () => {
    const before = { id: 'b-1', name: 'Arriendo' };
    const after = { id: 'b-1', name: 'Arriendo', deleted_at: '2026-03-01T10:00:00Z' };

    expect(diffSnapshots(snapshotFromRows([before]), snapshotFromRows([after]), NONE)[0].op).toBe('delete');
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
