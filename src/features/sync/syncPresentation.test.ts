import { describe, it, expect } from 'vitest';
import { es } from '@/shared/i18n/translations/es';
import { en } from '@/shared/i18n/translations/en';
import type {
  SyncActivityEvent,
  SyncErrorInfo,
  SyncHealthState,
  SyncRecordChange,
} from '@/application/useSyncStatus';
import {
  ALERT_ANNOUNCE_WINDOW_MS,
  NO_ALERT,
  describeChangeText,
  formatClockTime,
  healthVisual,
  isAlertFresh,
  matchesFilter,
  relativeTime,
  summarizeEvent,
  trackAlert,
  visibleSyncState,
} from './syncPresentation';

// Local wall-clock times, so HH:mm expectations hold in any time zone.
const AT = new Date(2026, 9, 17, 14, 32).getTime();
const RETRIED_AT = new Date(2026, 9, 17, 14, 35).getTime();

function change(overrides: Partial<SyncRecordChange> = {}): SyncRecordChange {
  return {
    table: 'expenses',
    op: 'create',
    id: 'e-1',
    label: 'Mercado',
    amount: 45_000,
    currency: 'COP',
    month: null,
    ...overrides,
  };
}

function changes(count: number): SyncRecordChange[] {
  return Array.from({ length: count }, (_, i) => change({ id: `e-${i}`, label: `Gasto ${i}` }));
}

function errorOf(kind: SyncErrorInfo['kind']): SyncErrorInfo {
  return { kind, message: `${kind} failure`, code: '23505', status: 409, table: 'expenses', op: 'PUT', recordId: 'e-1' };
}

// ---------------------------------------------------------------------------
// visibleSyncState / healthVisual
// ---------------------------------------------------------------------------

describe('visibleSyncState()', () => {
  it('shows offline once the offline alert is due', () => {
    expect(visibleSyncState({ state: 'offline', alert: { kind: 'offline', severity: 'info' } })).toBe('offline');
  });

  it('shows a neutral syncing state while offline but before the alert delay runs out', () => {
    expect(visibleSyncState({ state: 'offline', alert: null })).toBe('syncing');
  });

  it.each<SyncHealthState>(['synced', 'syncing', 'pending', 'error'])('passes %s through', (state) => {
    expect(visibleSyncState({ state, alert: null })).toBe(state);
  });
});

describe('healthVisual()', () => {
  it.each([
    ['synced', 'synced', 'muted'],
    ['syncing', 'syncing', 'brand'],
    ['pending', 'pending', 'now'],
    ['offline', 'offline', 'muted'],
    ['error', 'error', 'negative'],
  ] as const)('maps %s to the %s icon in the %s tone', (state, icon, tone) => {
    expect(healthVisual(state)).toEqual({ icon, tone });
  });

  it('draws a warning-level error in the attention tone, not the problem tone', () => {
    expect(healthVisual('error', 'warning')).toEqual({ icon: 'error', tone: 'now' });
    expect(healthVisual('error', 'error')).toEqual({ icon: 'error', tone: 'negative' });
  });
});

// ---------------------------------------------------------------------------
// describeChangeText
// ---------------------------------------------------------------------------

describe('describeChangeText()', () => {
  it('names a new expense and uses its label as the detail', () => {
    expect(describeChangeText(change(), es)).toEqual({ title: 'Gasto registrado', detail: 'Mercado' });
  });

  it('calls a new expense with a negative amount a reversal', () => {
    expect(describeChangeText(change({ amount: -45_000 }), es).title).toBe('Gasto anulado');
    expect(describeChangeText(change({ amount: -45_000 }), en).title).toBe('Expense reversed');
  });

  it('agrees in gender with feminine records', () => {
    expect(describeChangeText(change({ table: 'exchange_rates', op: 'update' }), es).title).toBe('TRM actualizada');
    expect(describeChangeText(change({ table: 'debts', op: 'delete' }), es).title).toBe('Deuda eliminada');
    expect(describeChangeText(change({ table: 'debt_transactions' }), es).title).toBe(
      'Transacción de deuda registrada',
    );
  });

  it('names members and holders', () => {
    expect(describeChangeText(change({ table: 'household_members' }), es).title).toBe('Integrante creado');
    expect(describeChangeText(change({ table: 'household_members', op: 'delete' }), en).title).toBe('Member deleted');
    expect(describeChangeText(change({ table: 'holders' }), es).title).toBe('Titular asignado');
    expect(describeChangeText(change({ table: 'holders', op: 'delete' }), es).title).toBe('Titular quitado');
    expect(describeChangeText(change({ table: 'holders', op: 'delete' }), en).title).toBe('Holder removed');
    expect(describeChangeText(change({ table: 'assets' }), es).title).toBe('Activo creado');
    expect(describeChangeText(change({ table: 'assets', op: 'delete' }), en).title).toBe('Asset deleted');
  });

  it('adds the month to the label', () => {
    const budgetMonth = change({ table: 'budget_months', op: 'update', month: '2026-10' });
    expect(describeChangeText(budgetMonth, es)).toEqual({
      title: 'Presupuesto del mes actualizado',
      detail: 'Mercado, Oct 2026',
    });
  });

  it('uses the month alone when there is no label', () => {
    const rate = change({ table: 'exchange_rates', label: null, month: '2026-03' });
    expect(describeChangeText(rate, en)).toEqual({ title: 'TRM recorded', detail: 'Mar 2026' });
  });

  it('falls back to a generic phrase for unknown tables', () => {
    const unknown = change({ table: 'ps_mystery', op: 'delete', label: null });
    expect(describeChangeText(unknown, es)).toEqual({ title: 'Registro eliminado', detail: null });
    expect(describeChangeText(unknown, en).title).toBe('Record deleted');
  });

  it('never resolves table names through the object prototype', () => {
    expect(describeChangeText(change({ table: 'toString' }), es).title).toBe('Registro creado');
  });
});

// ---------------------------------------------------------------------------
// summarizeEvent
// ---------------------------------------------------------------------------

describe('summarizeEvent()', () => {
  it('describes a single upload with its amount and time', () => {
    const event: SyncActivityEvent = { id: 'u1', kind: 'upload', at: AT, changes: [change()] };

    expect(summarizeEvent(event, es)).toEqual({
      id: 'u1',
      kind: 'upload',
      icon: 'upload',
      tone: 'brand',
      title: 'Gasto registrado',
      detail: 'Mercado',
      status: null,
      amount: 45_000,
      currency: 'COP',
      at: AT,
      time: '14:32',
    });
  });

  it('counts a multi-change upload and lists its changes', () => {
    const event: SyncActivityEvent = { id: 'u2', kind: 'upload', at: AT, changes: changes(3) };
    const row = summarizeEvent(event, es);

    expect(row.title).toBe('3 cambios subidos');
    expect(row.amount).toBeNull();
    expect(row.items).toHaveLength(3);
    expect(row.items?.[0]).toEqual({ key: 'e-0-0', title: 'Gasto registrado', detail: 'Gasto 0', amount: 45_000, currency: 'COP' });
    expect(row.moreCount).toBe(0);
  });

  it('counts downloads from `total` and keeps only the first five items', () => {
    const event: SyncActivityEvent = { id: 'd1', kind: 'download', at: AT, changes: changes(50), total: 57 };
    const row = summarizeEvent(event, es);

    expect(row).toMatchObject({ icon: 'download', tone: 'positive', title: '57 cambios recibidos' });
    expect(row.items).toHaveLength(5);
    expect(row.moreCount).toBe(52);
    expect(summarizeEvent(event, en).title).toBe('57 changes received');
  });

  it('previews the labels of a multi-change event in its detail', () => {
    const event: SyncActivityEvent = { id: 'd2', kind: 'download', at: AT, changes: changes(4), total: 4 };
    expect(summarizeEvent(event, es).detail).toBe('Gasto 0, Gasto 1, Gasto 2');
  });

  it("introduces a fresh device's first sync instead of listing received changes", () => {
    const event: SyncActivityEvent = { id: 'd0', kind: 'download', at: AT, changes: changes(50), total: 1_234, initial: true };

    expect(summarizeEvent(event, es)).toMatchObject({
      icon: 'download',
      tone: 'positive',
      title: 'Primera sincronización de este dispositivo',
      detail: '1234 registros descargados',
      amount: null,
      currency: null,
    });
    expect(summarizeEvent(event, es).items).toBeUndefined();
    expect(summarizeEvent(event, en)).toMatchObject({
      title: 'First sync on this device',
      detail: '1234 records downloaded',
    });
    expect(summarizeEvent({ ...event, total: 1 }, en).detail).toBe('1 record downloaded');
  });

  it('describes a single download like the change itself', () => {
    const event: SyncActivityEvent = {
      id: 'd3',
      kind: 'download',
      at: AT,
      changes: [change({ table: 'debts', label: 'Préstamo', amount: 3_000_000 })],
      total: 1,
    };
    expect(summarizeEvent(event, es)).toMatchObject({
      tone: 'positive',
      title: 'Deuda creada',
      detail: 'Préstamo',
      amount: 3_000_000,
    });
    expect(summarizeEvent(event, es).items).toBeUndefined();
  });

  it('shows the attempts of an unresolved upload failure', () => {
    const event: SyncActivityEvent = {
      id: 'f1',
      kind: 'upload-failed',
      at: AT,
      lastAttemptAt: AT,
      attempts: 3,
      changes: [change()],
      error: errorOf('rejected'),
      resolvedAt: null,
    };

    expect(summarizeEvent(event, es)).toMatchObject({
      icon: 'failed',
      tone: 'negative',
      title: 'Gasto registrado',
      status: { text: 'No se pudo subir tras 3 intentos', tone: 'negative' },
    });
    expect(summarizeEvent({ ...event, attempts: 1 }, en).status?.text).toBe("Couldn't upload");
  });

  it('says when a failed upload went through on a retry', () => {
    const event: SyncActivityEvent = {
      id: 'f2',
      kind: 'upload-failed',
      at: AT,
      lastAttemptAt: AT,
      attempts: 2,
      changes: changes(2),
      error: errorOf('server'),
      resolvedAt: RETRIED_AT,
    };
    const row = summarizeEvent(event, es);

    expect(row).toMatchObject({
      tone: 'muted',
      title: '2 cambios sin subir',
      status: { text: 'Se subió en un reintento a las 14:35', tone: 'positive' },
    });
    expect(summarizeEvent(event, en).status?.text).toBe('Uploaded on a retry at 14:35');
  });

  it('describes connection events in a muted tone', () => {
    const connected: SyncActivityEvent = { id: 'c1', kind: 'connection', at: AT, state: 'connected', error: null };
    const lost: SyncActivityEvent = { id: 'c2', kind: 'connection', at: AT, state: 'disconnected', error: null };
    const failed: SyncActivityEvent = { id: 'c3', kind: 'connection', at: AT, state: 'error', error: errorOf('auth') };

    expect(summarizeEvent(connected, es)).toMatchObject({
      icon: 'connected',
      tone: 'muted',
      title: 'Conexión establecida',
      detail: null,
    });
    expect(summarizeEvent(lost, es)).toMatchObject({ icon: 'disconnected', title: 'Conexión perdida' });
    expect(summarizeEvent(failed, es)).toMatchObject({
      icon: 'connection-error',
      tone: 'muted',
      title: 'Error de conexión',
      detail: 'La sesión expiró',
    });
  });

  it('shows exchange rates as plain numbers, not money', () => {
    const event: SyncActivityEvent = {
      id: 'u3',
      kind: 'upload',
      at: AT,
      changes: [change({ table: 'exchange_rates', op: 'update', label: 'USD/COP', amount: 4_150.5, currency: 'COP' })],
    };
    expect(summarizeEvent(event, es)).toMatchObject({ amount: 4_150.5, currency: null });
  });
});

// ---------------------------------------------------------------------------
// matchesFilter
// ---------------------------------------------------------------------------

describe('matchesFilter()', () => {
  const upload: SyncActivityEvent = { id: 'u', kind: 'upload', at: AT, changes: [change()] };
  const failed: SyncActivityEvent = {
    id: 'f',
    kind: 'upload-failed',
    at: AT,
    lastAttemptAt: AT,
    attempts: 1,
    changes: [change()],
    error: errorOf('rejected'),
    resolvedAt: null,
  };
  const download: SyncActivityEvent = { id: 'd', kind: 'download', at: AT, changes: [change()], total: 1 };
  const connected: SyncActivityEvent = { id: 'c', kind: 'connection', at: AT, state: 'connected', error: null };
  const connectionError: SyncActivityEvent = { id: 'e', kind: 'connection', at: AT, state: 'error', error: errorOf('server') };
  const all = [upload, failed, download, connected, connectionError];
  const ids = (filter: Parameters<typeof matchesFilter>[1]) =>
    all.filter((event) => matchesFilter(event, filter)).map((event) => event.id);

  it('keeps everything for "all"', () => {
    expect(ids('all')).toEqual(['u', 'f', 'd', 'c', 'e']);
  });

  it('keeps uploads and failed uploads for "uploads"', () => {
    expect(ids('uploads')).toEqual(['u', 'f']);
  });

  it('keeps downloads for "downloads"', () => {
    expect(ids('downloads')).toEqual(['d']);
  });

  it('keeps failed uploads and connection errors for "errors"', () => {
    expect(ids('errors')).toEqual(['f', 'e']);
  });
});

// ---------------------------------------------------------------------------
// relativeTime / formatClockTime
// ---------------------------------------------------------------------------

describe('relativeTime()', () => {
  const NOW = AT;

  it('says "now" under a minute', () => {
    expect(relativeTime(NOW - 40_000, NOW, 'es')).toBe('ahora');
    expect(relativeTime(NOW - 40_000, NOW, 'en')).toBe('now');
  });

  it('counts whole minutes, then hours', () => {
    expect(relativeTime(NOW - 2 * 60_000 - 5_000, NOW, 'es')).toBe('hace 2 minutos');
    expect(relativeTime(NOW - 2 * 60_000, NOW, 'en')).toBe('2 minutes ago');
    expect(relativeTime(NOW - 3 * 3_600_000, NOW, 'es')).toBe('hace 3 horas');
  });

  it('counts days after a day', () => {
    expect(relativeTime(NOW - 26 * 3_600_000, NOW, 'es')).toBe('ayer');
    expect(relativeTime(NOW - 3 * 86_400_000, NOW, 'en')).toBe('3 days ago');
  });

  it('treats timestamps ahead of the clock as now', () => {
    expect(relativeTime(NOW + 15_000, NOW, 'es')).toBe('ahora');
  });
});

describe('formatClockTime()', () => {
  it('formats local 24-hour time with leading zeros', () => {
    expect(formatClockTime(new Date(2026, 0, 2, 9, 5).getTime())).toBe('09:05');
    expect(formatClockTime(RETRIED_AT)).toBe('14:35');
  });
});

// ---------------------------------------------------------------------------
// Alert announcements
// ---------------------------------------------------------------------------

describe('trackAlert()', () => {
  const connection = { kind: 'connection', severity: 'warning' } as const;
  const rejected = { kind: 'upload-rejected', severity: 'error' } as const;

  it('starts the clock when an alert appears', () => {
    expect(trackAlert(NO_ALERT, connection, 1_000)).toEqual({ key: 'connection:warning', since: 1_000 });
  });

  it('keeps the first time while the same alert continues', () => {
    const tracked = trackAlert(NO_ALERT, connection, 1_000);
    expect(trackAlert(tracked, connection, 9_000)).toBe(tracked);
  });

  it('restarts the clock for a different alert, by kind or by severity', () => {
    const tracked = trackAlert(NO_ALERT, connection, 1_000);
    expect(trackAlert(tracked, rejected, 5_000)).toEqual({ key: 'upload-rejected:error', since: 5_000 });
    expect(trackAlert(tracked, { kind: 'connection', severity: 'error' }, 6_000).since).toBe(6_000);
  });

  it('forgets the alert once it clears', () => {
    const tracked = trackAlert(NO_ALERT, connection, 1_000);
    expect(trackAlert(tracked, null, 2_000)).toBe(NO_ALERT);
    expect(trackAlert(NO_ALERT, null, 2_000)).toBe(NO_ALERT);
  });
});

describe('isAlertFresh()', () => {
  it('announces only in the first moments after the alert appeared', () => {
    expect(isAlertFresh(1_000, 1_000)).toBe(true);
    expect(isAlertFresh(1_000, 1_000 + ALERT_ANNOUNCE_WINDOW_MS - 1)).toBe(true);
    expect(isAlertFresh(1_000, 1_000 + ALERT_ANNOUNCE_WINDOW_MS)).toBe(false);
  });

  it('never announces without an alert', () => {
    expect(isAlertFresh(null, 1_000)).toBe(false);
  });
});
