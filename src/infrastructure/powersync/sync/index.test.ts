import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  stopDownloads: vi.fn(),
  stopConnection: vi.fn(),
  stopSharing: vi.fn(),
  channel: { postMessage: () => {}, addEventListener: () => {}, removeEventListener: () => {}, close: () => {} },
}));

vi.mock('../client', () => ({ db: { name: 'app-db' } }));
vi.mock('../SupabaseConnector', () => ({ SupabaseConnector: vi.fn() }));
vi.mock('./downloadTracker', () => ({ startDownloadTracking: vi.fn(() => mocks.stopDownloads) }));
vi.mock('./connectionTracker', () => ({ startConnectionTracking: vi.fn(() => mocks.stopConnection) }));
vi.mock('./uploadIdSharing', () => ({
  startUploadIdSharing: vi.fn(() => mocks.stopSharing),
  openUploadIdChannel: vi.fn(() => mocks.channel),
}));

import { db } from '../client';
import { startDownloadTracking } from './downloadTracker';
import { startConnectionTracking } from './connectionTracker';
import { startUploadIdSharing } from './uploadIdSharing';
import { TRACKED_TABLES, labelCache, startSyncActivityTracking, syncActivity } from './index';

describe('startSyncActivityTracking()', () => {
  let stop: (() => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    stop?.();
    stop = undefined;
  });

  it('starts each tracker once with the app singletons', () => {
    stop = startSyncActivityTracking();
    const again = startSyncActivityTracking();

    expect(again).toBe(stop);
    expect(startConnectionTracking).toHaveBeenCalledOnce();
    expect(startConnectionTracking).toHaveBeenCalledWith({ db, store: syncActivity });
    expect(startDownloadTracking).toHaveBeenCalledOnce();
    expect(startDownloadTracking).toHaveBeenCalledWith({ db, store: syncActivity, labelCache, tables: TRACKED_TABLES });
    expect(startUploadIdSharing).toHaveBeenCalledOnce();
    expect(startUploadIdSharing).toHaveBeenCalledWith({ store: syncActivity, channel: mocks.channel });
  });

  it('stops everything once, and can start again afterwards', () => {
    const first = startSyncActivityTracking();
    first();
    first();

    expect(mocks.stopConnection).toHaveBeenCalledOnce();
    expect(mocks.stopDownloads).toHaveBeenCalledOnce();
    expect(mocks.stopSharing).toHaveBeenCalledOnce();

    stop = startSyncActivityTracking();
    expect(stop).not.toBe(first);
    expect(startDownloadTracking).toHaveBeenCalledTimes(2);
  });

  it('leaves nothing of the session behind when it stops (sign-out, user change)', () => {
    const first = startSyncActivityTracking();
    syncActivity.recordUpload([
      { table: 'budgets', op: 'create', id: 'b-1', label: 'Arriendo', amount: 1, currency: 'COP', month: null },
    ]);
    labelCache.setNames('budgets', new Map([['b-1', 'Arriendo']]));

    first();

    expect(syncActivity.getSnapshot().events).toEqual([]);
    expect(syncActivity.recentlyUploadedIds(60_000)).toEqual(new Set());
    expect(labelCache.getName('budgets', 'b-1')).toBeNull();
  });
});

describe('TRACKED_TABLES', () => {
  it('is every table of the app schema', () => {
    expect(TRACKED_TABLES).toEqual([
      'households',
      'users',
      'budgets',
      'budget_months',
      'expenses',
      'incomes',
      'income_months',
      'exchange_rates',
      'debts',
      'debt_transactions',
      'household_members',
      'holders',
      'assets',
      'asset_valuations',
    ]);
  });
});
