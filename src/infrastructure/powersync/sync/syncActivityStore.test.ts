import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSyncActivityStore, selectUnresolvedUploadFailure, syncActivity } from './syncActivityStore';
import type { SyncErrorInfo, SyncRecordChange } from './types';

let clock = 0;
const now = () => clock;

function makeStore(maxEvents?: number) {
  let n = 0;
  return createSyncActivityStore({ now, maxEvents, idFactory: () => `evt-${++n}` });
}

function changeOf(id: string, table = 'expenses'): SyncRecordChange {
  return { table, op: 'create', id, label: null, amount: 1_000, currency: 'COP', month: null };
}

function errorOf(message: string, kind: SyncErrorInfo['kind'] = 'rejected'): SyncErrorInfo {
  return { kind, message, code: null, status: null, table: 'expenses', op: 'PUT', recordId: 'e-1' };
}

beforeEach(() => {
  clock = 1_000;
});

describe('createSyncActivityStore()', () => {
  it('starts an empty session', () => {
    const store = makeStore();

    expect(store.getSnapshot()).toEqual({
      sessionStartedAt: 1_000,
      events: [],
      connection: { connectedAt: null, disconnectedSince: null, downloadErrorSince: null, lastSyncedAt: null },
    });
  });

  describe('snapshots', () => {
    it('returns the same object until something changes', () => {
      const store = makeStore();
      const first = store.getSnapshot();

      expect(store.getSnapshot()).toBe(first);

      store.recordUpload([changeOf('e-1')]);
      const second = store.getSnapshot();

      expect(second).not.toBe(first);
      expect(first.events).toEqual([]);
      expect(store.getSnapshot()).toBe(second);
    });

    it('keeps the snapshot for no-op calls', () => {
      const store = makeStore();
      const before = store.getSnapshot();

      store.recordDownload([]);
      store.updateConnection({ connectedAt: null });
      store.clear();

      expect(store.getSnapshot()).toBe(before);
    });
  });

  describe('recordUpload()', () => {
    it('adds an upload event, newest first', () => {
      const store = makeStore();
      store.recordUpload([changeOf('e-1')]);
      clock = 2_000;
      store.recordUpload([changeOf('e-2')]);

      expect(store.getSnapshot().events).toEqual([
        { id: 'evt-2', kind: 'upload', at: 2_000, changes: [changeOf('e-2')] },
        { id: 'evt-1', kind: 'upload', at: 1_000, changes: [changeOf('e-1')] },
      ]);
    });

    it('resolves unresolved failures that share a change id', () => {
      const store = makeStore();
      store.recordUploadFailure([changeOf('e-1'), changeOf('e-2')], errorOf('rls'));
      clock = 5_000;

      store.recordUpload([changeOf('e-2')]);

      const [upload, failure] = store.getSnapshot().events;
      expect(upload.kind).toBe('upload');
      expect(failure).toMatchObject({ kind: 'upload-failed', resolvedAt: 5_000 });
      expect(selectUnresolvedUploadFailure(store.getSnapshot())).toBeNull();
    });

    it('leaves failures of other records unresolved', () => {
      const store = makeStore();
      store.recordUploadFailure([changeOf('e-1')], errorOf('rls'));

      store.recordUpload([changeOf('e-9')]);

      expect(selectUnresolvedUploadFailure(store.getSnapshot())).toMatchObject({ resolvedAt: null });
    });
  });

  describe('recordUploadFailure()', () => {
    it('records the first attempt', () => {
      const store = makeStore();
      store.recordUploadFailure([changeOf('e-1')], errorOf('rls'));

      expect(store.getSnapshot().events).toEqual([
        {
          id: 'evt-1',
          kind: 'upload-failed',
          at: 1_000,
          lastAttemptAt: 1_000,
          attempts: 1,
          changes: [changeOf('e-1')],
          error: errorOf('rls'),
          resolvedAt: null,
        },
      ]);
    });

    it('folds retries of the same failure into the newest event', () => {
      const store = makeStore();
      store.recordUploadFailure([changeOf('e-1'), changeOf('e-2')], errorOf('rls'));
      clock = 6_000;
      store.recordUploadFailure([changeOf('e-2'), changeOf('e-1')], errorOf('rls'));
      clock = 11_000;
      store.recordUploadFailure([changeOf('e-1'), changeOf('e-2')], errorOf('rls'));

      const { events } = store.getSnapshot();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ id: 'evt-1', at: 1_000, lastAttemptAt: 11_000, attempts: 3 });
    });

    it('adds a new event when the error message changes', () => {
      const store = makeStore();
      store.recordUploadFailure([changeOf('e-1')], errorOf('TypeError: Failed to fetch', 'offline'));
      store.recordUploadFailure([changeOf('e-1')], errorOf('JWT expired', 'auth'));

      const { events } = store.getSnapshot();
      expect(events).toHaveLength(2);
      expect(events[0]).toMatchObject({ attempts: 1, error: { kind: 'auth' } });
    });

    it('adds a new event when the changes differ', () => {
      const store = makeStore();
      store.recordUploadFailure([changeOf('e-1')], errorOf('rls'));
      store.recordUploadFailure([changeOf('e-1'), changeOf('e-3')], errorOf('rls'));

      expect(store.getSnapshot().events).toHaveLength(2);
    });

    it('adds a new event when the newest event is not that failure', () => {
      const store = makeStore();
      store.recordUploadFailure([changeOf('e-1')], errorOf('rls'));
      store.recordDownload([changeOf('x-1')]);
      store.recordUploadFailure([changeOf('e-1')], errorOf('rls'));

      expect(store.getSnapshot().events.map((e) => e.kind)).toEqual(['upload-failed', 'download', 'upload-failed']);
    });
  });

  describe('recordDownload()', () => {
    it('ignores empty change lists', () => {
      const store = makeStore();
      store.recordDownload([]);

      expect(store.getSnapshot().events).toEqual([]);
    });

    it('defaults total to the number of changes', () => {
      const store = makeStore();
      store.recordDownload([changeOf('x-1'), changeOf('x-2')]);
      store.recordDownload([changeOf('x-3')], 40);

      expect(store.getSnapshot().events).toEqual([
        { id: 'evt-2', kind: 'download', at: 1_000, changes: [changeOf('x-3')], total: 40 },
        { id: 'evt-1', kind: 'download', at: 1_000, changes: [changeOf('x-1'), changeOf('x-2')], total: 2 },
      ]);
    });
  });

  describe('recordConnection()', () => {
    it('records state transitions and skips repeats of the same state and error', () => {
      const store = makeStore();
      store.recordConnection('connected');
      store.recordConnection('connected');
      store.recordConnection('error', errorOf('HTTP Unauthorized', 'auth'));
      store.recordConnection('error', errorOf('HTTP Unauthorized', 'auth'));
      store.recordConnection('error', errorOf('HTTP Bad Gateway', 'server'));
      store.recordConnection('disconnected');

      expect(store.getSnapshot().events.map((e) => (e.kind === 'connection' ? `${e.state}:${e.error?.message ?? ''}` : e.kind))).toEqual([
        'disconnected:',
        'error:HTTP Bad Gateway',
        'error:HTTP Unauthorized',
        'connected:',
      ]);
    });

    it('stores the error, or null', () => {
      const store = makeStore();
      store.recordConnection('connected');

      expect(store.getSnapshot().events[0]).toEqual({ id: 'evt-1', kind: 'connection', at: 1_000, state: 'connected', error: null });
    });

    it('still dedupes when other events happened in between', () => {
      const store = makeStore();
      store.recordConnection('connected');
      store.recordDownload([changeOf('x-1')]);
      store.recordConnection('connected');

      expect(store.getSnapshot().events.map((e) => e.kind)).toEqual(['download', 'connection']);
    });

    it('dedupes consecutive errors by kind and code, not by message', () => {
      const store = makeStore();
      store.recordConnection('error', { ...errorOf('HTTP Bad Gateway (request 1)', 'server'), code: 'PSYNC_S2001' });
      store.recordConnection('error', { ...errorOf('HTTP Bad Gateway (request 2)', 'server'), code: 'PSYNC_S2001' });
      store.recordConnection('error', { ...errorOf('HTTP Bad Gateway (request 3)', 'server'), code: 'PSYNC_S2002' });

      const messages = store.getSnapshot().events.map((e) => (e.kind === 'connection' ? e.error?.message : null));
      expect(messages).toEqual(['HTTP Bad Gateway (request 3)', 'HTTP Bad Gateway (request 1)']);
    });
  });

  describe('rememberUploadedIds()', () => {
    it('adds ids uploaded elsewhere to the recent-upload memory without logging an upload', () => {
      const store = makeStore();
      const before = store.getSnapshot();

      store.rememberUploadedIds(['e-1', 'e-2']);

      expect(store.recentlyUploadedIds(60_000)).toEqual(new Set(['e-1', 'e-2']));
      expect(store.getSnapshot()).toBe(before);
    });

    it('resolves unresolved failures of those records', () => {
      const store = makeStore();
      store.recordUploadFailure([changeOf('e-1')], errorOf('rls'));
      clock = 4_000;

      store.rememberUploadedIds(['e-1']);

      expect(store.getSnapshot().events).toEqual([expect.objectContaining({ kind: 'upload-failed', resolvedAt: 4_000 })]);
    });

    it('does not notify upload listeners (no cross-tab echo)', () => {
      const store = makeStore();
      const listener = vi.fn();
      store.onUpload(listener);

      store.rememberUploadedIds(['e-1']);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('onUpload()', () => {
    it('reports the unique ids of each recorded upload until unsubscribed', () => {
      const store = makeStore();
      const listener = vi.fn();
      const unsubscribe = store.onUpload(listener);

      store.recordUpload([changeOf('e-1'), changeOf('e-1'), changeOf('e-2')]);
      unsubscribe();
      store.recordUpload([changeOf('e-3')]);

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(['e-1', 'e-2']);
    });
  });

  describe('updateConnection()', () => {
    it('merges the timeline patch', () => {
      const store = makeStore();
      store.updateConnection({ connectedAt: 2_000, lastSyncedAt: 2_500 });
      store.updateConnection({ disconnectedSince: 3_000, connectedAt: undefined });

      expect(store.getSnapshot().connection).toEqual({
        connectedAt: 2_000,
        disconnectedSince: 3_000,
        downloadErrorSince: null,
        lastSyncedAt: 2_500,
      });
    });

    it('keeps the snapshot when nothing changes', () => {
      const store = makeStore();
      store.updateConnection({ connectedAt: 2_000 });
      const before = store.getSnapshot();

      store.updateConnection({ connectedAt: 2_000 });

      expect(store.getSnapshot()).toBe(before);
    });
  });

  describe('ring buffer', () => {
    it('keeps only the newest maxEvents', () => {
      const store = makeStore(3);
      for (const id of ['a', 'b', 'c', 'd', 'e']) store.recordDownload([changeOf(id)]);

      expect(store.getSnapshot().events.map((e) => (e.kind === 'download' ? e.changes[0].id : null))).toEqual([
        'e',
        'd',
        'c',
      ]);
    });

    it('defaults to 200 events', () => {
      const store = makeStore();
      for (let i = 0; i < 205; i++) store.recordDownload([changeOf(`x-${i}`)]);

      expect(store.getSnapshot().events).toHaveLength(200);
    });
  });

  describe('clear()', () => {
    it('empties the log and keeps the session start and the connection timeline', () => {
      const store = makeStore();
      store.updateConnection({ connectedAt: 1_500 });
      store.recordUpload([changeOf('e-1')]);
      clock = 9_000;

      store.clear();

      expect(store.getSnapshot()).toEqual({
        sessionStartedAt: 1_000,
        events: [],
        connection: { connectedAt: 1_500, disconnectedSince: null, downloadErrorSince: null, lastSyncedAt: null },
      });
    });

    it('keeps the uploaded ids used to recognise echoes', () => {
      const store = makeStore();
      store.recordUpload([changeOf('e-1')]);

      store.clear();

      expect(store.recentlyUploadedIds(60_000)).toEqual(new Set(['e-1']));
    });
  });

  describe('subscribe()', () => {
    it('notifies on changes until unsubscribed', () => {
      const store = makeStore();
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);

      store.recordUpload([changeOf('e-1')]);
      store.recordDownload([]);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      store.recordUpload([changeOf('e-2')]);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('recentlyUploadedIds()', () => {
    it('returns the ids uploaded within the window', () => {
      const store = makeStore();
      store.recordUpload([changeOf('a'), changeOf('b')]);
      clock = 61_000;
      store.recordUpload([changeOf('c')]);
      clock = 91_000;

      expect(store.recentlyUploadedIds(60_000)).toEqual(new Set(['c']));
      expect(store.recentlyUploadedIds(120_000)).toEqual(new Set(['a', 'b', 'c']));
    });

    it('forgets ids after 10 minutes', () => {
      const store = makeStore();
      store.recordUpload([changeOf('a')]);
      clock = 1_000 + 10 * 60_000 + 1;
      store.recordUpload([changeOf('b')]);

      expect(store.recentlyUploadedIds(Number.POSITIVE_INFINITY)).toEqual(new Set(['b']));
    });
  });
});

describe('selectUnresolvedUploadFailure()', () => {
  it('returns the newest unresolved failure', () => {
    const store = makeStore();
    store.recordUploadFailure([changeOf('e-1')], errorOf('first'));
    store.recordUploadFailure([changeOf('e-1')], errorOf('second'));

    expect(selectUnresolvedUploadFailure(store.getSnapshot())).toMatchObject({ error: { message: 'second' } });
  });

  it('returns null without failures', () => {
    expect(selectUnresolvedUploadFailure(makeStore().getSnapshot())).toBeNull();
  });
});

describe('syncActivity', () => {
  it('is an app-wide store instance', () => {
    expect(syncActivity.getSnapshot().events).toEqual([]);
    expect(typeof syncActivity.subscribe).toBe('function');
  });
});
