import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startConnectionTracking, type ConnectionStatusLike, type ConnectionTrackerDb } from './connectionTracker';
import { createSyncActivityStore, type SyncActivityStore } from './syncActivityStore';

interface StatusInput {
  connected?: boolean;
  connecting?: boolean;
  lastSyncedAt?: Date;
  downloadError?: Error;
}

function status({ downloadError, ...flags }: StatusInput = {}): ConnectionStatusLike {
  return { connected: false, connecting: false, ...flags, dataFlowStatus: downloadError ? { downloadError } : {} };
}

/** Fake db that lets the test push status changes to the registered listener. */
function createFakeDb(initial: ConnectionStatusLike) {
  let listener: ((next: ConnectionStatusLike) => void) | undefined;
  const unregister = vi.fn();
  const db = {
    currentStatus: initial,
    registerListener: vi.fn((l: { statusChanged?: (next: ConnectionStatusLike) => void }) => {
      listener = l.statusChanged;
      return unregister;
    }),
  };
  return {
    db: db as ConnectionTrackerDb,
    unregister,
    emit: (next: ConnectionStatusLike) => {
      db.currentStatus = next;
      listener?.(next);
    },
  };
}

let clock = 1_000;
let store: SyncActivityStore;

function start(fake: ReturnType<typeof createFakeDb>, isOnline: () => boolean = () => true) {
  return startConnectionTracking({ db: fake.db, store, now: () => clock, isOnline });
}

/** Moves both the fake clock and the timers. */
function advance(ms: number) {
  clock += ms;
  vi.advanceTimersByTime(ms);
}

function connectionLog() {
  return store
    .getSnapshot()
    .events.map((event) => (event.kind === 'connection' ? `${event.state}${event.error ? `:${event.error.kind}` : ''}` : event.kind));
}

beforeEach(() => {
  vi.useFakeTimers();
  clock = 1_000;
  store = createSyncActivityStore({ now: () => clock });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('startConnectionTracking()', () => {
  it('records the connection when the first status is connected', () => {
    start(createFakeDb(status({ connected: true })));

    expect(store.getSnapshot().connection).toMatchObject({ connectedAt: 1_000, disconnectedSince: null });
    expect(connectionLog()).toEqual(['connected']);
  });

  it('marks a first status that is not connected, but logs no loss before the first connection', () => {
    const fake = createFakeDb(status({ connecting: true }));
    start(fake);

    expect(store.getSnapshot().connection).toMatchObject({ connectedAt: null, disconnectedSince: 1_000 });
    advance(10_000);
    expect(connectionLog()).toEqual([]);

    fake.emit(status({ connected: true }));
    fake.emit(status({ connecting: true }));
    advance(2_999);
    expect(connectionLog()).toEqual(['connected']);
    advance(1);
    expect(connectionLog()).toEqual(['disconnected', 'connected']);
  });

  it('updates the timeline immediately but ignores drops shorter than 3 s', () => {
    const fake = createFakeDb(status({ connected: true }));
    start(fake);

    clock = 2_000;
    fake.emit(status());
    expect(store.getSnapshot().connection).toMatchObject({ connectedAt: null, disconnectedSince: 2_000 });

    advance(2_000);
    fake.emit(status({ connected: true }));
    advance(5_000);

    expect(store.getSnapshot().connection).toMatchObject({ connectedAt: 4_000, disconnectedSince: null });
    expect(connectionLog()).toEqual(['connected']);
  });

  it('logs a drop that lasts, and the reconnection after it', () => {
    const fake = createFakeDb(status({ connected: true }));
    start(fake);

    fake.emit(status({ connecting: true }));
    advance(3_000);
    fake.emit(status());
    fake.emit(status({ connected: true }));

    expect(connectionLog()).toEqual(['connected', 'disconnected', 'connected']);
  });

  it('records a download error once, classified, and times it', () => {
    const fake = createFakeDb(status({ connected: true }));
    start(fake);

    clock = 2_000;
    fake.emit(status({ connected: true, downloadError: new Error('PSYNC_S2101: Authentication required (req 1)') }));
    clock = 2_500;
    fake.emit(status({ connected: true, downloadError: new Error('PSYNC_S2101: Authentication required (req 2)') }));

    expect(connectionLog()).toEqual(['error:auth', 'connected']);
    expect(store.getSnapshot().events[0]).toMatchObject({ error: { kind: 'auth', message: expect.stringContaining('req 1') } });
    expect(store.getSnapshot().connection.downloadErrorSince).toBe(2_000);
  });

  it('records a new error event when the kind changes, and clears the timer when the error goes away', () => {
    const fake = createFakeDb(status({ connected: true }));
    start(fake);

    fake.emit(status({ connected: true, downloadError: new Error('PSYNC_S2101: Authentication required') }));
    fake.emit(status({ connected: true, downloadError: new Error('HTTP Bad Gateway') }));
    clock = 9_000;
    fake.emit(status({ connected: true }));

    expect(connectionLog()).toEqual(['error:server', 'error:auth', 'connected']);
    expect(store.getSnapshot().connection.downloadErrorSince).toBeNull();
  });

  it('does not repeat an error after the disconnect it caused', () => {
    const fake = createFakeDb(status({ connected: true }));
    start(fake);

    fake.emit(status({ downloadError: new TypeError('Failed to fetch') }));
    advance(3_000);
    fake.emit(status({ connecting: true, downloadError: new TypeError('Failed to fetch') }));
    fake.emit(status({ downloadError: new TypeError('Failed to fetch') }));

    expect(connectionLog()).toEqual(['disconnected', 'error:offline', 'connected']);
  });

  it('keeps a flapping error with no connection change in between as one entry', () => {
    const fake = createFakeDb(status({ connected: true }));
    start(fake);

    fake.emit(status({ connected: true, downloadError: new Error('HTTP Bad Gateway') }));
    fake.emit(status({ connected: true }));
    fake.emit(status({ connected: true, downloadError: new Error('HTTP Bad Gateway') }));

    expect(connectionLog()).toEqual(['error:server', 'connected']);
  });

  it('logs a recurring error again after the connection changed in between', () => {
    const fake = createFakeDb(status({ connected: true }));
    start(fake);

    fake.emit(status({ connected: true, downloadError: new Error('HTTP Bad Gateway') }));
    fake.emit(status());
    advance(3_000);
    fake.emit(status({ connected: true }));
    fake.emit(status({ connected: true, downloadError: new Error('HTTP Bad Gateway') }));

    expect(connectionLog()).toEqual(['error:server', 'connected', 'disconnected', 'error:server', 'connected']);
  });

  it('classifies errors with the browser online state', () => {
    const fake = createFakeDb(status({ connected: true }));
    start(fake, () => false);

    fake.emit(status({ downloadError: new Error('Stream closed') }));

    expect(store.getSnapshot().events[0]).toMatchObject({ kind: 'connection', state: 'error', error: { kind: 'offline' } });
  });

  it('keeps the last synced time reported by PowerSync', () => {
    const fake = createFakeDb(status({ connected: true }));
    start(fake);

    fake.emit(status({ connected: true, lastSyncedAt: new Date(5_000) }));
    fake.emit(status({ connected: true }));

    expect(store.getSnapshot().connection.lastSyncedAt).toBe(5_000);
  });

  it('stops listening and cancels a pending disconnect', () => {
    const fake = createFakeDb(status({ connected: true }));
    const stop = start(fake);
    fake.emit(status({ connecting: true }));
    advance(1_000);

    stop();
    advance(10_000);

    expect(fake.unregister).toHaveBeenCalledOnce();
    expect(connectionLog()).toEqual(['connected']);
  });
});
