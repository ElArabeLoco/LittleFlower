import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WatchOnChangeHandler } from '@powersync/web';
import { startDownloadTracking, type DownloadTrackerDb, type DownloadTrackerStatus } from './downloadTracker';
import { createSyncActivityStore, type SyncActivityStore } from './syncActivityStore';
import { createLabelCache, type LabelCache } from './labelCache';

type Row = Record<string, unknown>;

interface FakeStatus {
  hasSynced: boolean;
  lastSyncedAt?: Date;
  dataFlowStatus: { downloading: boolean };
}

/**
 * In-memory stand-in for the PowerSync db: tables, ps_crud, onChange and the
 * sync status. `checkpoint()` is PowerSync applying a downloaded checkpoint.
 */
function createFakeDb(initial: Record<string, Row[]> = {}, { hasSynced = true }: { hasSynced?: boolean } = {}) {
  const tables = new Map<string, Row[]>(Object.entries(initial));
  let pendingIds: string[] = [];
  let changeHandler: WatchOnChangeHandler | null = null;
  let statusListener: ((status: DownloadTrackerStatus) => void) | undefined;
  let status: FakeStatus = {
    hasSynced,
    lastSyncedAt: hasSynced ? new Date(500) : undefined,
    dataFlowStatus: { downloading: false },
  };
  let checkpoints = 0;
  let afterRead: (() => void) | null = null;
  const unsubscribe = vi.fn();
  const unregister = vi.fn();

  const getAll = vi.fn(async (sql: string): Promise<Row[]> => {
    const result = sql.includes('ps_crud')
      ? pendingIds.map((id) => ({ data: JSON.stringify({ op: 'PUT', type: 'expenses', id, data: {} }) }))
      : (tables.get(/FROM (\w+)/.exec(sql)?.[1] ?? '') ?? []).map((row) => ({ ...row }));
    const hook = afterRead;
    afterRead = null;
    hook?.();
    return result;
  });
  const onChange = vi.fn((handler: WatchOnChangeHandler) => {
    changeHandler = handler;
    return unsubscribe;
  });
  const registerListener = vi.fn((listener: { statusChanged?: (status: DownloadTrackerStatus) => void }) => {
    statusListener = listener.statusChanged;
    return unregister;
  });
  const db = {
    get currentStatus() {
      return status;
    },
    waitForReady: vi.fn(async () => {}),
    getAll,
    onChange,
    registerListener,
  };

  function pushStatus(next: Partial<FakeStatus>) {
    status = { ...status, ...next };
    statusListener?.(status);
  }

  return {
    db,
    getAll,
    onChange,
    registerListener,
    unsubscribe,
    unregister,
    setRows: (table: string, rows: Row[]) => tables.set(table, rows),
    setPending: (ids: string[]) => {
      pendingIds = ids;
    },
    /** PowerSync reporting changed tables (local writes and applied checkpoints alike). */
    emit: (...changedTables: string[]) => {
      void changeHandler?.onChange({ changedTables });
    },
    /** PowerSync applied a downloaded checkpoint. */
    checkpoint: () =>
      pushStatus({ hasSynced: true, lastSyncedAt: new Date(10_000 + ++checkpoints), dataFlowStatus: { downloading: false } }),
    pushStatus,
    /** Runs `write` right after the next read has produced its result. */
    afterNextRead: (write: () => void) => {
      afterRead = write;
    },
  };
}

type FakeDb = ReturnType<typeof createFakeDb>;

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

function start(fake: FakeDb, tables = ['budgets', 'expenses']) {
  return startDownloadTracking({
    db: fake.db as unknown as DownloadTrackerDb,
    store,
    labelCache: labels,
    tables,
    now: () => clock,
  });
}

/** Starts tracking and waits for the baseline. */
async function started(fake: FakeDb, tables?: string[]) {
  const stop = start(fake, tables);
  await flush();
  return stop;
}

/** A checkpoint bringing changes to `tables`, in the order PowerSync reports them. */
async function receive(fake: FakeDb, ...tables: string[]) {
  fake.checkpoint();
  fake.emit(...tables.map((table) => `ps_data__${table}`));
  await flush();
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
  describe('baseline', () => {
    it('watches the tracked tables and the sync status, and logs nothing for the baseline', async () => {
      const fake = createFakeDb({ budgets: [budget()], expenses: [expense()] });

      await started(fake);

      expect(fake.onChange).toHaveBeenCalledWith(expect.objectContaining({ onChange: expect.any(Function) }), {
        tables: ['budgets', 'expenses'],
        throttleMs: 150,
      });
      expect(fake.registerListener).toHaveBeenCalledWith({ statusChanged: expect.any(Function) });
      expect(fake.getAll.mock.calls.map(([sql]) => sql)).toEqual(['SELECT * FROM budgets', 'SELECT * FROM expenses']);
      expect(store.getSnapshot().events).toEqual([]);
    });

    it('seeds budget / income / debt names into the label cache', async () => {
      const fake = createFakeDb({ budgets: [budget()], incomes: [{ id: 'i-1', name: 'Salario Ana' }], debts: [] });

      await started(fake, ['budgets', 'incomes', 'debts']);

      expect(labels.getName('budgets', 'b-1')).toBe('Arriendo');
      expect(labels.getName('incomes', 'i-1')).toBe('Salario Ana');
    });
  });

  describe('runs only for applied checkpoints', () => {
    it('logs partner changes once a checkpoint is applied', async () => {
      const fake = createFakeDb({ budgets: [budget()], expenses: [] });
      await started(fake);

      fake.setRows('expenses', [expense()]);
      fake.emit('ps_data__expenses');
      await flush();
      expect(downloads()).toEqual([]);

      fake.checkpoint();
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

    it('also runs when the table changes are reported right after the checkpoint', async () => {
      const fake = createFakeDb({ expenses: [] });
      await started(fake);

      fake.setRows('expenses', [expense()]);
      await receive(fake, 'expenses');

      expect(downloads()).toHaveLength(1);
    });

    it('treats the end of a download as an applied checkpoint', async () => {
      const fake = createFakeDb({ expenses: [] });
      await started(fake);

      fake.setRows('expenses', [expense()]);
      fake.emit('ps_data__expenses');
      fake.pushStatus({ dataFlowStatus: { downloading: true } });
      fake.pushStatus({ dataFlowStatus: { downloading: false } });
      await flush();

      expect(downloads()).toHaveLength(1);
    });

    it('does not rescan tables for local-only writes', async () => {
      const fake = createFakeDb({ expenses: [] });
      await started(fake);
      fake.getAll.mockClear();

      for (let i = 0; i < 3; i++) {
        fake.setRows('expenses', [expense({ id: `e-${i}` })]);
        fake.setPending([`e-${i}`]);
        fake.emit('ps_data__expenses');
      }
      await flush();

      expect(fake.getAll).not.toHaveBeenCalled();
    });

    it('leaves changes reported long after a checkpoint for the next one', async () => {
      const fake = createFakeDb({ expenses: [] });
      await started(fake);
      fake.checkpoint();
      await flush();
      fake.getAll.mockClear();

      clock += 3_000;
      fake.setRows('expenses', [expense()]);
      fake.emit('ps_data__expenses');
      await flush();
      expect(fake.getAll).not.toHaveBeenCalled();

      fake.checkpoint();
      await flush();
      expect(downloads()).toHaveLength(1);
    });
  });

  describe('changes that are ours', () => {
    it('skips local writes still waiting in ps_crud', async () => {
      const fake = createFakeDb({ expenses: [] });
      await started(fake);

      fake.setRows('expenses', [expense()]);
      fake.setPending(['e-1']);
      await receive(fake, 'expenses');

      expect(downloads()).toEqual([]);
    });

    it('skips the echo of a recent upload', async () => {
      const fake = createFakeDb({ expenses: [expense()] });
      await started(fake);

      store.recordUpload([
        { table: 'expenses', op: 'update', id: 'e-1', label: null, amount: 60_000, currency: 'COP', month: null },
      ]);
      fake.setRows('expenses', [expense({ amount: 60_000, last_edited_at: '2026-03-01T10:00:00Z' })]);
      await receive(fake, 'expenses');

      expect(downloads()).toEqual([]);
    });

    it('skips writes uploaded since the previous run, however long ago', async () => {
      const fake = createFakeDb({ expenses: [] });
      await started(fake);

      clock = 2_000;
      store.recordUpload([
        { table: 'expenses', op: 'create', id: 'e-1', label: null, amount: 50_000, currency: 'COP', month: null },
      ]);
      clock = 2_000 + 5 * 60_000;
      fake.setRows('expenses', [expense(), expense({ id: 'e-2', note: 'De Ana' })]);
      await receive(fake, 'expenses');

      expect(downloads()[0].changes.map((change) => change.id)).toEqual(['e-2']);
    });

    it('never logs a local write that lands between the reads of one run', async () => {
      const fake = createFakeDb({ expenses: [] });
      await started(fake);

      fake.afterNextRead(() => {
        fake.setRows('expenses', [expense()]);
        fake.setPending(['e-1']);
      });
      await receive(fake, 'expenses');
      expect(downloads()).toEqual([]);

      await receive(fake, 'expenses');
      expect(downloads()).toEqual([]);
    });
  });

  describe('what gets logged', () => {
    it('records a soft delete as a delete', async () => {
      const fake = createFakeDb({ budgets: [budget()] });
      await started(fake);

      fake.setRows('budgets', [budget({ deleted_at: '2026-03-01T10:00:00Z' })]);
      await receive(fake, 'budgets');

      expect(downloads()[0].changes).toEqual([expect.objectContaining({ table: 'budgets', op: 'delete', id: 'b-1' })]);
    });

    it('labels a removed row from what the snapshot kept', async () => {
      const fake = createFakeDb({ budgets: [budget()] });
      await started(fake);

      fake.setRows('budgets', []);
      await receive(fake, 'budgets');

      expect(downloads()[0].changes).toEqual([
        { table: 'budgets', op: 'delete', id: 'b-1', label: 'Arriendo', amount: 1_500_000, currency: 'COP', month: null },
      ]);
    });

    it('puts every change of one run into a single event', async () => {
      const fake = createFakeDb({ budgets: [budget()], expenses: [] });
      await started(fake);

      fake.setRows('budgets', [budget({ default_amount: 1_600_000 })]);
      fake.setRows('expenses', [expense()]);
      await receive(fake, 'budgets', 'expenses');

      expect(downloads()).toHaveLength(1);
      expect(downloads()[0].changes.map((c) => `${c.table}:${c.op}`)).toEqual(['budgets:update', 'expenses:create']);
    });

    it('describes changes with names that arrived in the same run', async () => {
      const fake = createFakeDb({ budgets: [], expenses: [] });
      await started(fake);

      fake.setRows('budgets', [budget({ id: 'b-2', name: 'Mercado' })]);
      fake.setRows('expenses', [expense({ budget_id: 'b-2' })]);
      await receive(fake, 'budgets', 'expenses');

      expect(downloads()[0].changes.find((c) => c.table === 'expenses')?.label).toBe('Mercado');
      expect(labels.getName('budgets', 'b-2')).toBe('Mercado');
    });

    it('rebuilds the label cache after every run', async () => {
      const fake = createFakeDb({ budgets: [budget()] });
      await started(fake);

      fake.setRows('budgets', [budget({ name: 'Renta' })]);
      await receive(fake, 'budgets');

      expect(labels.getName('budgets', 'b-1')).toBe('Renta');
    });

    it('keeps at most 50 changes per event and reports the total', async () => {
      const fake = createFakeDb({ expenses: [] });
      await started(fake);

      fake.setRows(
        'expenses',
        Array.from({ length: 60 }, (_, i) => expense({ id: `e-${i}` })),
      );
      await receive(fake, 'expenses');

      expect(downloads()[0]).toMatchObject({ total: 60 });
      expect(downloads()[0].changes).toHaveLength(50);
    });
  });

  describe('first sync of a fresh device', () => {
    it('marks it as initial instead of implying other devices', async () => {
      const fake = createFakeDb({ budgets: [], expenses: [] }, { hasSynced: false });
      await started(fake);

      fake.setRows('budgets', [budget()]);
      fake.setRows('expenses', [expense(), expense({ id: 'e-2' })]);
      await receive(fake, 'budgets', 'expenses');

      expect(downloads()).toEqual([expect.objectContaining({ initial: true, total: 3 })]);
    });

    it('does not mark the downloads after it', async () => {
      const fake = createFakeDb({ expenses: [] }, { hasSynced: false });
      await started(fake);
      fake.setRows('expenses', [expense()]);
      await receive(fake, 'expenses');

      clock += 60_000;
      fake.setRows('expenses', [expense(), expense({ id: 'e-2' })]);
      await receive(fake, 'expenses');

      expect(downloads().map((event) => event.initial ?? false)).toEqual([false, true]);
    });

    it('does not mark downloads on a device that synced before', async () => {
      const fake = createFakeDb({ expenses: [] }, { hasSynced: true });
      await started(fake);

      fake.setRows('expenses', [expense()]);
      await receive(fake, 'expenses');

      expect(downloads()[0].initial).toBeUndefined();
    });
  });

  describe('robustness', () => {
    it('runs serially and queues at most one more run', async () => {
      const fake = createFakeDb({ expenses: [] });
      await started(fake);

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
      await receive(fake, 'expenses');
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
      await started(fake);
      fake.getAll.mockClear();

      fake.setRows('expenses', [expense()]);
      fake.checkpoint();
      fake.emit('ps_data_local__expenses', 'ps_data__users', 'ps_crud');
      await flush();

      expect(fake.getAll.mock.calls.map(([sql]) => sql)).toEqual(['SELECT * FROM expenses', 'SELECT data FROM ps_crud']);
      expect(downloads()).toHaveLength(1);
    });

    it('never throws into the app when a query fails, and keeps tracking', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const fake = createFakeDb({ expenses: [] });
      await started(fake);

      fake.getAll.mockRejectedValueOnce(new Error('database is closed'));
      await receive(fake, 'expenses');
      expect(warn).toHaveBeenCalled();

      fake.setRows('expenses', [expense()]);
      await receive(fake, 'expenses');
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

    it('stops watching changes and the sync status', async () => {
      const fake = createFakeDb({ expenses: [] });
      const stop = await started(fake);

      stop();
      fake.setRows('expenses', [expense()]);
      await receive(fake, 'expenses');

      expect(fake.unsubscribe).toHaveBeenCalledOnce();
      expect(fake.unregister).toHaveBeenCalledOnce();
      expect(downloads()).toEqual([]);
    });

    it('never puts a table name that is not a plain identifier into SQL', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const fake = createFakeDb({ expenses: [] });

      await started(fake, ['expenses', 'expenses; DROP TABLE users']);

      expect(fake.getAll.mock.calls.map(([sql]) => sql)).toEqual(['SELECT * FROM expenses']);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });
});
