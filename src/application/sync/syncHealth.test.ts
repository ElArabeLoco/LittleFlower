import { describe, it, expect } from 'vitest';
import {
  CONNECTION_ALERT_DELAY_MS,
  OFFLINE_ALERT_DELAY_MS,
  deriveSyncHealth,
  type SyncHealthInput,
} from './syncHealth';
import type { SyncErrorInfo, SyncErrorKind } from '@/infrastructure/powersync/sync';

const NOW = 100_000;

function input(overrides: Partial<SyncHealthInput> = {}): SyncHealthInput {
  return {
    connected: true,
    connecting: false,
    uploading: false,
    downloading: false,
    hasUploadError: false,
    hasDownloadError: false,
    uploadFailure: null,
    uploadError: null,
    downloadError: null,
    pendingCount: 0,
    online: true,
    disconnectedSince: null,
    downloadErrorSince: null,
    now: NOW,
    ...overrides,
  };
}

function errorOf(kind: SyncErrorKind): SyncErrorInfo {
  return { kind, message: `${kind} failure`, code: null, status: null, table: 'expenses', op: 'PUT', recordId: 'e-1' };
}

describe('deriveSyncHealth()', () => {
  it('is synced when connected, idle and nothing is pending', () => {
    expect(deriveSyncHealth(input())).toEqual({
      state: 'synced',
      pendingCount: 0,
      error: null,
      alert: null,
      nextCheckAt: null,
    });
  });

  it('is pending while changes wait to upload', () => {
    expect(deriveSyncHealth(input({ pendingCount: 3 }))).toMatchObject({ state: 'pending', pendingCount: 3, alert: null });
  });

  it.each([{ uploading: true }, { downloading: true }, { connected: false, connecting: true }])(
    'is syncing while %o',
    (flags) => {
      expect(deriveSyncHealth(input({ ...flags, pendingCount: 2 }))).toMatchObject({ state: 'syncing', alert: null });
    },
  );

  describe('rule 1 — upload problems', () => {
    it.each(['rejected', 'server', 'unknown'] as const)(
      'a %s upload failure is an error with an upload-rejected alert',
      (kind) => {
        const failure = errorOf(kind);

        expect(deriveSyncHealth(input({ uploadFailure: failure, hasUploadError: true, pendingCount: 1 }))).toEqual({
          state: 'error',
          pendingCount: 1,
          error: failure,
          alert: { kind: 'upload-rejected', severity: 'error' },
          nextCheckAt: null,
        });
      },
    );

    it('an auth upload failure is an error with an auth alert', () => {
      const failure = errorOf('auth');

      expect(deriveSyncHealth(input({ uploadFailure: failure, pendingCount: 1 }))).toMatchObject({
        state: 'error',
        error: failure,
        alert: { kind: 'auth', severity: 'error' },
      });
    });

    it("uses the store's classification, not the status error", () => {
      const failure = errorOf('auth');

      const health = deriveSyncHealth(
        input({ uploadFailure: failure, hasUploadError: true, uploadError: errorOf('unknown'), pendingCount: 1 }),
      );

      expect(health.alert?.kind).toBe('auth');
      expect(health.error).toBe(failure);
    });

    it('falls back to the classified status error when this tab logged no failure', () => {
      const statusError = errorOf('server');

      expect(deriveSyncHealth(input({ hasUploadError: true, uploadError: statusError, pendingCount: 1 }))).toMatchObject({
        state: 'error',
        error: statusError,
        alert: { kind: 'upload-rejected' },
      });
    });

    it('treats an unclassified status upload error as a rejected upload', () => {
      expect(deriveSyncHealth(input({ hasUploadError: true, pendingCount: 1 }))).toMatchObject({
        state: 'error',
        error: null,
        alert: { kind: 'upload-rejected', severity: 'error' },
      });
    });

    it('ignores a logged failure once nothing is pending any more', () => {
      expect(deriveSyncHealth(input({ uploadFailure: errorOf('rejected'), pendingCount: 0 })).state).toBe('synced');
    });

    it('never turns an offline upload failure into an error', () => {
      const offlineFailure = { uploadFailure: errorOf('offline'), hasUploadError: true, pendingCount: 1 };

      expect(deriveSyncHealth(input(offlineFailure))).toMatchObject({ state: 'pending', error: null, alert: null });
      expect(deriveSyncHealth(input({ ...offlineFailure, online: false, disconnectedSince: NOW }))).toMatchObject({
        state: 'offline',
        error: null,
      });
    });

    it('outranks being offline', () => {
      expect(
        deriveSyncHealth(input({ uploadFailure: errorOf('rejected'), pendingCount: 1, online: false, disconnectedSince: NOW })),
      ).toMatchObject({ state: 'error', alert: { kind: 'upload-rejected' } });
    });
  });

  describe('rule 2 — offline', () => {
    it('shows offline at once but alerts only after the delay (blip)', () => {
      const since = NOW - 1_000;

      expect(deriveSyncHealth(input({ online: false, connected: false, disconnectedSince: since }))).toEqual({
        state: 'offline',
        pendingCount: 0,
        error: null,
        alert: null,
        nextCheckAt: since + OFFLINE_ALERT_DELAY_MS,
      });
    });

    it('alerts once the delay has passed', () => {
      const health = deriveSyncHealth(
        input({ online: false, connected: false, disconnectedSince: NOW - OFFLINE_ALERT_DELAY_MS }),
      );

      expect(health).toMatchObject({ state: 'offline', alert: { kind: 'offline', severity: 'info' }, nextCheckAt: null });
    });

    it('treats a stopped stream (not connected, not connecting) as offline', () => {
      const health = deriveSyncHealth(input({ connected: false, connecting: false, disconnectedSince: NOW - 6_000 }));

      expect(health).toMatchObject({ state: 'offline', alert: { kind: 'offline' } });
    });

    it('waits for the disconnect time before scheduling an alert', () => {
      expect(deriveSyncHealth(input({ online: false, disconnectedSince: null }))).toMatchObject({
        state: 'offline',
        alert: null,
        nextCheckAt: null,
      });
    });

    it('outranks a download error and pending changes', () => {
      const health = deriveSyncHealth(
        input({
          online: false,
          connected: false,
          connecting: true,
          hasDownloadError: true,
          downloadError: errorOf('offline'),
          downloadErrorSince: NOW - 60_000,
          disconnectedSince: NOW - 60_000,
          pendingCount: 4,
        }),
      );

      expect(health).toMatchObject({ state: 'offline', pendingCount: 4, alert: { kind: 'offline' } });
    });
  });

  describe('rule 3 — download / connection errors', () => {
    const retrying = { connected: false, connecting: true, hasDownloadError: true };

    it('keeps syncing quietly during the delay (blip)', () => {
      const since = NOW - 2_000;

      expect(deriveSyncHealth(input({ ...retrying, downloadError: errorOf('server'), downloadErrorSince: since }))).toEqual({
        state: 'syncing',
        pendingCount: 0,
        error: null,
        alert: null,
        nextCheckAt: since + CONNECTION_ALERT_DELAY_MS,
      });
    });

    it('becomes an error with a connection warning after the delay', () => {
      const error = errorOf('server');

      expect(
        deriveSyncHealth(input({ ...retrying, downloadError: error, downloadErrorSince: NOW - CONNECTION_ALERT_DELAY_MS })),
      ).toEqual({
        state: 'error',
        pendingCount: 0,
        error,
        alert: { kind: 'connection', severity: 'warning' },
        nextCheckAt: null,
      });
    });

    it('becomes an auth error after the delay when the session is the problem', () => {
      const error = errorOf('auth');

      expect(deriveSyncHealth(input({ ...retrying, downloadError: error, downloadErrorSince: NOW - 20_000 }))).toMatchObject({
        state: 'error',
        error,
        alert: { kind: 'auth', severity: 'error' },
      });
    });

    it('waits for the error start time before scheduling an alert', () => {
      expect(deriveSyncHealth(input({ ...retrying, downloadError: errorOf('server') }))).toMatchObject({
        state: 'syncing',
        alert: null,
        nextCheckAt: null,
      });
    });

    it('outranks pending changes', () => {
      expect(
        deriveSyncHealth(
          input({ ...retrying, downloadError: errorOf('unknown'), downloadErrorSince: NOW - 30_000, pendingCount: 2 }),
        ),
      ).toMatchObject({ state: 'error', pendingCount: 2, alert: { kind: 'connection' } });
    });
  });
});
