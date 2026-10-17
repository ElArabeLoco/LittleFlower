import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WatchOnChangeHandler } from '@powersync/web';
import { startDownloadTracking, type DownloadTrackerDb } from './downloadTracker';
import { createSyncActivityStore, type SyncActivityStore } from './syncActivityStore';
import { createLabelCache, type LabelCache } from './labelCache';

type Row = Record<string, unknown>;

/** In-memory stand-in for the PowerSync db: tables, ps_crud and onChange. */
function createFakeDb(initial: Record<string, Row[]> = {}) {
  const tables = new Map<string, Row[]>(Object.entries(initial));
  let pendingIds: string[] = [];
  let handler: WatchOnChangeHandler | null = null;
  const unsubscribe = vi.fn();

  const getAll = vi.fn(async (sql: string): Promise<Row[]> => {
    if (sql.includes('ps_crud')) {
      return pendingIds.map((id) => ({ data: JSON.stringify({ op: 'PUT', type: 'expenses', id, data: {} }) }));
    }
    const table = /FROM (\w+)/.exec(sql)?.[1] ?? '';
    return (tables.get(table) ?? []).map((row) => ({ ...row }));
  });
  const onChange = vi.fn((h: WatchOnChangeHandler) => {
    handler = h;
    return unsubscribe;
  });
  const db = { waitForReady: vi.fn(async () => {}), getAll, onChange };

  return {
    db,
    getAll,
    onChange,
    unsubscribe,
    setRows: (table: string, rows: Row[]) => tables.set(table, rows),
    setPending: (ids: string[]) => {
      pendingIds = ids;
    },
    emit: (...changedTables: string[]) => {
      void handler?.onChange({ changedTables });
    },
  };
}

/** Lets every pending promise chain of the tracker settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const budget = (overrides: Row = {}): Row => ({
  id: 'b-1',
  name: 'Arriendo',
  default_amount: 1_500_000,
  deleted_at: null,
  ...overrides,
});
const expense = (overrides: Row = {}): Row => ({
  id: 'e-1',
  budget_id: 'b-1',
  amount: 50_000,
  note: null,
  deleted_at: null,
  ...overrides,
});

let clock = 1_000;
let store: SyncActivityStore;
let labels: LabelCache;

function start(fake: ReturnType<typeof createFakeDb>, tables = ['budgets', 'expenses']) {
  return startDownloadTracking({ db: fake.db as unknown as DownloadTrackerDb, store, labelCache: labels, tables });
}

function downloads() {
  return store.getSnapshot().events.filter((event) => event.kind === 'download');
}

beforeEach(() => {
  clock = 1_000;
  store = createSyncActivityStore({ now: () => clock });
  labels = createLabelCache();
});

describe('startDownloadTracking()', () => {
  it('watches the tracked tables and takes a baseline without logging it', async () => {
    const fake = createFakeDb({ budgets: [budget()], expenses: [expense()] });

    start(fake);
    await flush();

    expect(fake.onChange).toHaveBeenCalledWith(expect.objectContaining({ onChange: expect.any(Function) }), {
      tables: ['budgets', 'expenses'],
      throttleMs: 150,
    });
    expect(fake.getAll).toHaveBeenCalledWith('SELECT * FROM budgets');
    expect(fake.getAll).toHaveBeenCalledWith('SELECT * FROM expenses');
    expect(store.getSnapshot().events).toEqual([]);
  });

  it('seeds budget / income / debt names into the label cache', async () => {
    const fake = createFakeDb({ budgets: [budget()], incomes: [{ id: 'i-1', name: 'Salario Ana' }], debts: [] });

    start(fake, ['budgets', 'incomes', 'debts']);
    await flush();

    expect(labels.getName('budgets', 'b-1')).toBe('Arriendo');
    expect(labels.getName('incomes', 'i-1')).toBe('Salario Ana');
  });

  it('records a partner change as a download', async () => {
    const fake = createFakeDb({ budgets: [budget()], expenses: [] });
    start(fake);
    await flush();

    fake.setRows('expenses', [expense()]);
    fake.emit('ps_data__expenses');
    await flush();

    expect(downloads()).toEqual([
      {
        id: expect.any(String),
        kind: 'download',
        at: 1_000,
        total: 1,
        changes: [
          { table: 'expenses', op: 'create', id: 'e-1', label: 'Arriendo', amount: 50_000, currency: 'COP', month: null },
        ],
      },
    ]);
  });

  it('skips local writes still waiting in ps_crud', async () => {
    const fake = createFakeDb({ expenses: [] });
    start(fake);
    await flush();

    fake.setRows('expenses', [expense()]);
    fake.setPending(['e-1']);
    fake.emit('ps_data__expenses');
    await flush();

    expect(downloads()).toEqual([]);
  });

  it('skips the echo of a recent upload', async () => {
    const fake = createFakeDb({ expenses: [expense()] });
    start(fake);
    await flush();

    store.recordUpload([
      { table: 'expenses', op: 'update', id: 'e-1', label: null, amount: 60_000, currency: 'COP', month: null },
    ]);
    fake.setRows('expenses', [expense({ amount: 60_000, last_edited_at: '2026-03-01T10:00:00Z' })]);
    fake.emit('ps_data__expenses');
    await flush();

    expect(downloads()).toEqual([]);
  });

  it('records a soft delete as a delete', async () => {
    const fake = createFakeDb({ budgets: [budget()] });
    start(fake);
    await flush();

    fake.setRows('budgets', [budget({ deleted_at: '2026-03-01T10:00:00Z' })]);
    fake.emit('ps_data__budgets');
    await flush();

    expect(downloads()[0].changes).toEqual([expect.objectContaining({ table: 'budgets', op: 'delete', id: 'b-1' })]);
  });

  it('puts every change of one run into a single event', async () => {
    const fake = createFakeDb({ budgets: [budget()], expenses: [] });
    start(fake);
    await flush();

    fake.setRows('budgets', [budget({ default_amount: 1_600_000 })]);
    fake.setRows('expenses', [expense()]);
    fake.emit('ps_data__budgets', 'ps_data__expenses');
    await flush();

    expect(downloads()).toHaveLength(1);
    expect(downloads()[0].changes.map((c) => `${c.table}:${c.op}`)).toEqual(['budgets:update', 'expenses:create']);
  });

  it('describes changes with names that arrived in the same run', async () => {
    const fake = createFakeDb({ budgets: [], expenses: [] });
    start(fake);
    await flush();

    fake.setRows('budgets', [budget({ id: 'b-2', name: 'Mercado' })]);
    fake.setRows('expenses', [expense({ budget_id: 'b-2' })]);
    fake.emit('ps_data__budgets', 'ps_data__expenses');
    await flush();

    expect(downloads()[0].changes.find((c) => c.table === 'expenses')?.label).toBe('Mercado');
    expect(labels.getName('budgets', 'b-2')).toBe('Mercado');
  });

  it('rebuilds the label cache after every run', async () => {
    const fake = createFakeDb({ budgets: [budget()] });
    start(fake);
    await flush();

    fake.setRows('budgets', [budget({ name: 'Renta' })]);
    fake.emit('ps_data__budgets');
    await flush();

    expect(labels.getName('budgets', 'b-1')).toBe('Renta');
  });

  it('runs serially and queues at most one more run', async () => {
    const fake = createFakeDb({ expenses: [] });
    start(fake);
    await flush();

    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const plainGetAll = fake.getAll.getMockImplementation()!;
    fake.getAll.mockImplementation(async (sql: string) => {
      if (sql === 'SELECT * FROM expenses') await gate;
      return plainGetAll(sql);
    });

    fake.setRows('expenses', [expense()]);
    fake.emit('ps_data__expenses');
    await flush();
    fake.emit('ps_data__expenses');
    fake.emit('ps_data__expenses');
    fake.emit('ps_data__expenses');
    release();
    await flush();

    const tableReads = fake.getAll.mock.calls.filter(([sql]) => sql === 'SELECT * FROM expenses');
    expect(tableReads).toHaveLength(1 + 2); // baseline + running run + one queued run
    expect(downloads()).toHaveLength(1);
  });

  it('strips the ps_data_local__ prefix and ignores tables it does not track', async () => {
    const fake = createFakeDb({ expenses: [] });
    start(fake);
    await flush();
    fake.getAll.mockClear();

    fake.setRows('expenses', [expense()]);
    fake.emit('ps_data_local__expenses', 'ps_data__users', 'ps_crud');
    await flush();

    expect(fake.getAll.mock.calls.map(([sql]) => sql)).toEqual(['SELECT data FROM ps_crud', 'SELECT * FROM expenses']);
    expect(downloads()).toHaveLength(1);
  });

  it('keeps at most 50 changes per event and reports the total', async () => {
    const fake = createFakeDb({ expenses: [] });
    start(fake);
    await flush();

    fake.setRows(
      'expenses',
      Array.from({ length: 60 }, (_, i) => expense({ id: `e-${i}` })),
    );
    fake.emit('ps_data__expenses');
    await flush();

    expect(downloads()[0]).toMatchObject({ total: 60 });
    expect(downloads()[0].changes).toHaveLength(50);
  });

  it('never throws into the app when a query fails, and keeps tracking', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fake = createFakeDb({ expenses: [] });
    start(fake);
    await flush();

    fake.getAll.mockRejectedValueOnce(new Error('database is closed'));
    fake.emit('ps_data__expenses');
    await flush();
    expect(warn).toHaveBeenCalled();

    fake.setRows('expenses', [expense()]);
    fake.emit('ps_data__expenses');
    await flush();
    expect(downloads()).toHaveLength(1);
    warn.mockRestore();
  });

  it('survives a baseline failure', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fake = createFakeDb({ expenses: [] });
    fake.db.waitForReady.mockRejectedValueOnce(new Error('open failed'));

    expect(() => start(fake)).not.toThrow();
    await flush();

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('stops watching', async () => {
    const fake = createFakeDb({ expenses: [] });
    const stop = start(fake);
    await flush();

    stop();
    fake.setRows('expenses', [expense()]);
    fake.emit('ps_data__expenses');
    await flush();

    expect(fake.unsubscribe).toHaveBeenCalledOnce();
    expect(downloads()).toEqual([]);
  });

  it('never puts a table name that is not a plain identifier into SQL', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fake = createFakeDb({ expenses: [] });

    start(fake, ['expenses', 'expenses; DROP TABLE users']);
    await flush();

    expect(fake.getAll.mock.calls.map(([sql]) => sql)).toEqual(['SELECT * FROM expenses']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
