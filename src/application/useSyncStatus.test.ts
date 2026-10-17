/**
 * useSyncStatus / useSyncActions / useSyncActivityTracking.
 *
 * Lives in application/sync/ next to the health model it wires up.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { SyncStatus } from '@powersync/web';

vi.mock('@powersync/react', () => ({ useStatus: vi.fn() }));
vi.mock('@/infrastructure/powersync/queries/useSyncQueries', () => ({ usePendingUploadCount: vi.fn() }));
vi.mock('@/shared/hooks/useOnlineStatus', () => ({ useOnlineStatus: vi.fn() }));
vi.mock('@/infrastructure/powersync/sync', async () => ({
  ...(await vi.importActual<object>('@/infrastructure/powersync/sync/syncActivityStore')),
  ...(await vi.importActual<object>('@/infrastructure/powersync/sync/syncErrors')),
  reconnectSync: vi.fn(),
  startSyncActivityTracking: vi.fn(),
}));

import { useStatus } from '@powersync/react';
import { usePendingUploadCount } from '@/infrastructure/powersync/queries/useSyncQueries';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { reconnectSync, startSyncActivityTracking } from '@/infrastructure/powersync/sync';
import { syncActivity } from '@/infrastructure/powersync/sync/syncActivityStore';
import type { SyncErrorInfo, SyncRecordChange } from '@/infrastructure/powersync/sync/types';
import { useSyncActions, useSyncActivityTracking, useSyncStatus } from './useSyncStatus';

interface StatusInput {
  connected?: boolean;
  connecting?: boolean;
  uploading?: boolean;
  downloading?: boolean;
  uploadError?: Error;
  downloadError?: Error;
  lastSyncedAt?: Date;
  downloadedFraction?: number;
}

function givenStatus(input: StatusInput = {}) {
  const { connected = true, connecting = false, uploading = false, downloading = false } = input;
  const status = {
    connected,
    connecting,
    lastSyncedAt: input.lastSyncedAt,
    dataFlowStatus: { uploading, downloading, uploadError: input.uploadError, downloadError: input.downloadError },
    downloadProgress: input.downloadedFraction === undefined ? null : { downloadedFraction: input.downloadedFraction },
  };
  vi.mocked(useStatus).mockReturnValue(status as unknown as SyncStatus);
}

const change: SyncRecordChange = {
  table: 'budgets',
  op: 'update',
  id: 'b-1',
  label: 'Arriendo',
  amount: 1_600_000,
  currency: 'COP',
  month: null,
};

const rejected: SyncErrorInfo = {
  kind: 'rejected',
  message: 'new row violates row-level security policy',
  code: '42501',
  status: 403,
  table: 'budgets',
  op: 'PATCH',
  recordId: 'b-1',
};

beforeEach(() => {
  vi.clearAllMocks();
  syncActivity.clear();
  syncActivity.updateConnection({ connectedAt: null, disconnectedSince: null, downloadErrorSince: null, lastSyncedAt: null });
  givenStatus();
  vi.mocked(usePendingUploadCount).mockReturnValue(0);
  vi.mocked(useOnlineStatus).mockReturnValue(true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useSyncStatus()', () => {
  it('combines the PowerSync status, the upload queue and the activity log', () => {
    givenStatus({ downloading: true, lastSyncedAt: new Date(42_000), downloadedFraction: 0.4 });
    vi.mocked(usePendingUploadCount).mockReturnValue(2);
    syncActivity.recordUpload([change]);

    const { result } = renderHook(() => useSyncStatus());

    expect(result.current.health).toMatchObject({ state: 'syncing', pendingCount: 2 });
    expect(result.current.events).toEqual([expect.objectContaining({ kind: 'upload', changes: [change] })]);
    expect(result.current.connection).toBe(syncActivity.getSnapshot().connection);
    expect(result.current.sessionStartedAt).toBe(syncActivity.getSnapshot().sessionStartedAt);
    expect(result.current.lastSyncedAt).toBe(42_000);
    expect(result.current.downloadFraction).toBe(0.4);
  });

  it('re-renders when the activity log changes', () => {
    const { result } = renderHook(() => useSyncStatus());

    act(() => syncActivity.recordDownload([change]));

    expect(result.current.events).toHaveLength(1);
  });

  it("takes the upload classification from the activity log, not from the status message", () => {
    syncActivity.recordUploadFailure([change], rejected);
    givenStatus({ uploadError: new Error('Supabase PATCH failed on budgets: JWT expired') });
    vi.mocked(usePendingUploadCount).mockReturnValue(1);

    const { result } = renderHook(() => useSyncStatus());

    expect(result.current.health).toMatchObject({ state: 'error', error: rejected, alert: { kind: 'upload-rejected' } });
  });

  it('falls back to classifying the status message when this tab logged no failure', () => {
    givenStatus({ uploadError: new Error('Supabase PUT failed on budgets: JWT expired') });
    vi.mocked(usePendingUploadCount).mockReturnValue(1);

    const { result } = renderHook(() => useSyncStatus());

    expect(result.current.health).toMatchObject({ state: 'error', alert: { kind: 'auth' } });
  });

  it('schedules one timeout for the next check and shows the alert when it fires', () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const setInterval = vi.spyOn(globalThis, 'setInterval');
    givenStatus({ connected: false, connecting: true });
    vi.mocked(useOnlineStatus).mockReturnValue(false);
    syncActivity.updateConnection({ disconnectedSince: 100_000 });

    const { result } = renderHook(() => useSyncStatus());
    expect(result.current.health).toMatchObject({ state: 'offline', alert: null, nextCheckAt: 105_000 });
    expect(vi.getTimerCount()).toBe(1);

    act(() => vi.advanceTimersByTime(4_999));
    expect(result.current.health.alert).toBeNull();

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.health).toMatchObject({ state: 'offline', alert: { kind: 'offline' }, nextCheckAt: null });
    expect(vi.getTimerCount()).toBe(0);
    expect(setInterval).not.toHaveBeenCalled();
  });

  it('replaces the timeout when the next check moves, and clears it on unmount', () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    givenStatus({ connected: false, connecting: true });
    vi.mocked(useOnlineStatus).mockReturnValue(false);
    syncActivity.updateConnection({ disconnectedSince: 100_000 });

    const { result, unmount } = renderHook(() => useSyncStatus());
    act(() => syncActivity.updateConnection({ disconnectedSince: 102_000 }));

    expect(result.current.health.nextCheckAt).toBe(107_000);
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('useSyncActions()', () => {
  it('retries by reconnecting the sync stream', async () => {
    const { result } = renderHook(() => useSyncActions());

    await act(() => result.current.retry());

    expect(reconnectSync).toHaveBeenCalledOnce();
  });

  it('clears the session log', () => {
    syncActivity.recordUpload([change]);
    const { result } = renderHook(() => useSyncActions());

    act(() => result.current.clearLog());

    expect(syncActivity.getSnapshot().events).toEqual([]);
  });

  it('builds a pretty JSON diagnostics report', () => {
    syncActivity.recordUploadFailure([change], rejected);
    vi.mocked(usePendingUploadCount).mockReturnValue(1);
    const { result } = renderHook(() => useSyncActions());

    const text = result.current.diagnosticsText();
    const report = JSON.parse(text);

    expect(text).toContain('\n  "generatedAt"');
    expect(report).toMatchObject({
      generatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      userAgent: navigator.userAgent,
      health: { state: 'error', pendingCount: 1, error: rejected },
      connection: syncActivity.getSnapshot().connection,
      events: [expect.objectContaining({ kind: 'upload-failed' })],
    });
  });
});

describe('useSyncActivityTracking()', () => {
  it('starts the trackers once', () => {
    const { rerender } = renderHook(() => useSyncActivityTracking());
    rerender();

    expect(startSyncActivityTracking).toHaveBeenCalledOnce();
  });
});
