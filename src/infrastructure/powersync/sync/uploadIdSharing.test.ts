import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  SYNC_ACTIVITY_CHANNEL,
  openUploadIdChannel,
  startUploadIdSharing,
  type UploadIdChannel,
} from './uploadIdSharing';
import { createSyncActivityStore } from './syncActivityStore';
import type { SyncErrorInfo, SyncRecordChange } from './types';

type MessageListener = (event: MessageEvent) => void;

/** In-memory BroadcastChannel stand-in: a message reaches every other open port. */
function createBus() {
  const ports = new Set<FakePort>();

  class FakePort implements UploadIdChannel {
    readonly listeners = new Set<MessageListener>();
    closed = false;

    constructor() {
      ports.add(this);
    }
    postMessage(data: unknown) {
      for (const port of ports) {
        if (port !== this) port.listeners.forEach((listener) => listener({ data } as MessageEvent));
      }
    }
    addEventListener(_type: 'message', listener: MessageListener) {
      this.listeners.add(listener);
    }
    removeEventListener(_type: 'message', listener: MessageListener) {
      this.listeners.delete(listener);
    }
    close() {
      this.closed = true;
      ports.delete(this);
    }
  }

  return { open: () => new FakePort() };
}

const changeOf = (id: string): SyncRecordChange => ({
  table: 'expenses',
  op: 'create',
  id,
  label: null,
  amount: 1_000,
  currency: 'COP',
  month: null,
});

const rejected: SyncErrorInfo = {
  kind: 'rejected',
  message: 'rls',
  code: '42501',
  status: 403,
  table: 'expenses',
  op: 'PUT',
  recordId: 'e-1',
};

function twoTabs() {
  const bus = createBus();
  const tabA = createSyncActivityStore();
  const tabB = createSyncActivityStore();
  const portA = bus.open();
  const portB = bus.open();
  const stopA = startUploadIdSharing({ store: tabA, channel: portA });
  const stopB = startUploadIdSharing({ store: tabB, channel: portB });
  return { bus, tabA, tabB, portA, portB, stopA, stopB };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('startUploadIdSharing()', () => {
  it('shares the ids uploaded in one tab with the other tabs', () => {
    const { tabA, tabB } = twoTabs();

    tabA.recordUpload([changeOf('e-1'), changeOf('e-2')]);

    expect(tabB.recentlyUploadedIds(60_000)).toEqual(new Set(['e-1', 'e-2']));
    expect(tabB.getSnapshot().events).toEqual([]);
  });

  it("resolves the other tab's failure for those records", () => {
    const { tabA, tabB } = twoTabs();
    tabB.recordUploadFailure([changeOf('e-1')], rejected);

    tabA.recordUpload([changeOf('e-1')]);

    expect(tabB.getSnapshot().events[0]).toMatchObject({ kind: 'upload-failed', resolvedAt: expect.any(Number) });
  });

  it('ignores messages it does not understand', () => {
    const { bus, tabB } = twoTabs();
    const stranger = bus.open();

    stranger.postMessage('hello');
    stranger.postMessage({ type: 'something-else', ids: ['x-1'] });
    stranger.postMessage({ type: 'uploaded-ids', ids: 'x-2' });
    stranger.postMessage({ type: 'uploaded-ids', ids: [42, 'x-3', ''] });

    expect(tabB.recentlyUploadedIds(60_000)).toEqual(new Set(['x-3']));
  });

  it('stops sharing and closes the channel', () => {
    const { tabA, tabB, portA, stopA } = twoTabs();

    stopA();
    tabA.recordUpload([changeOf('e-1')]);
    tabB.recordUpload([changeOf('e-2')]);

    expect(portA.closed).toBe(true);
    expect(tabB.recentlyUploadedIds(60_000)).toEqual(new Set(['e-2']));
    expect(tabA.recentlyUploadedIds(60_000)).toEqual(new Set(['e-1']));
  });

  it('a failing postMessage never reaches the upload that triggered it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let onUpload: ((ids: string[]) => void) | undefined;
    const store = {
      onUpload: (listener: (ids: string[]) => void) => {
        onUpload = listener;
        return () => {};
      },
      rememberUploadedIds: vi.fn(),
    };
    const channel: UploadIdChannel = {
      postMessage: () => {
        throw new DOMException('Channel is closed', 'InvalidStateError');
      },
      addEventListener: () => {},
      removeEventListener: () => {},
      close: () => {},
    };

    startUploadIdSharing({ store, channel });

    expect(() => onUpload?.(['e-1'])).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does nothing without a channel', () => {
    const store = createSyncActivityStore();

    const stop = startUploadIdSharing({ store, channel: null });
    store.recordUpload([changeOf('e-1')]);

    expect(() => stop()).not.toThrow();
  });
});

describe('openUploadIdChannel()', () => {
  it('returns null where BroadcastChannel is not available', () => {
    vi.stubGlobal('BroadcastChannel', undefined);

    expect(openUploadIdChannel()).toBeNull();
  });

  it('opens the shared sync activity channel', () => {
    const names: string[] = [];
    vi.stubGlobal(
      'BroadcastChannel',
      class {
        constructor(name: string) {
          names.push(name);
        }
      },
    );

    expect(openUploadIdChannel()).not.toBeNull();
    expect(names).toEqual([SYNC_ACTIVITY_CHANNEL]);
    expect(SYNC_ACTIVITY_CHANNEL).toBe('lf-sync-activity');
  });

  it('returns null when the channel cannot be opened', () => {
    vi.stubGlobal(
      'BroadcastChannel',
      class {
        constructor() {
          throw new Error('SecurityError');
        }
      },
    );

    expect(openUploadIdChannel()).toBeNull();
  });
});
