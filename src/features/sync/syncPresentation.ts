/**
 * Sync presentation — pure helpers that turn the sync model into the words,
 * icons and rows the sync UI shows.
 *
 * No React and no PowerSync: translations, locale and clock come in as
 * arguments, so every helper is deterministic and unit-tested.
 *
 *   visibleSyncState()   → the state the UI shows (hides offline until its alert)
 *   healthVisual()       → icon + tone for a state
 *   describeChangeText() → "Gasto registrado" + "Mercado, Oct 2026"
 *   summarizeEvent()     → one activity-log row
 *   matchesFilter()      → activity filter (all / uploads / downloads / errors)
 *   relativeTime()       → "hace 2 minutos"
 *   formatClockTime()    → "14:35"
 */

import type { Translations } from '@/shared/i18n/translations/es';
import type {
  SyncActivityEvent,
  SyncAlertSeverity,
  SyncHealth,
  SyncHealthState,
  SyncRecordChange,
} from '@/application/useSyncStatus';

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export type SyncIcon = 'synced' | 'syncing' | 'pending' | 'offline' | 'error';
export type SyncTone = 'muted' | 'brand' | 'now' | 'negative';

export interface HealthVisual {
  icon: SyncIcon;
  tone: SyncTone;
}

/**
 * The state the UI shows. `offline` is reported immediately (also before the
 * first connect), while its alert waits out short blips: until the alert is
 * due, the UI shows a neutral `syncing` instead of flashing "offline".
 */
export function visibleSyncState(health: Pick<SyncHealth, 'state' | 'alert'>): SyncHealthState {
  return health.state === 'offline' && health.alert?.kind !== 'offline' ? 'syncing' : health.state;
}

const VISUALS: Record<SyncHealthState, HealthVisual> = {
  synced: { icon: 'synced', tone: 'muted' },
  syncing: { icon: 'syncing', tone: 'brand' },
  pending: { icon: 'pending', tone: 'now' },
  offline: { icon: 'offline', tone: 'muted' },
  error: { icon: 'error', tone: 'negative' },
};

/**
 * Icon and tone for a state. An error whose alert is only a warning (the
 * connection keeps retrying on its own) takes the attention tone, so the
 * icon matches the alert band instead of sounding an alarm.
 */
export function healthVisual(state: SyncHealthState, severity?: SyncAlertSeverity | null): HealthVisual {
  if (state === 'error' && severity === 'warning') return { icon: 'error', tone: 'now' };
  return VISUALS[state];
}

// ---------------------------------------------------------------------------
// Record changes
// ---------------------------------------------------------------------------

export interface ChangeText {
  title: string;
  detail: string | null;
}

type RecordPhrases = Translations['sync']['records']['generic'];

const OP_PHRASE = { create: 'created', update: 'updated', delete: 'deleted' } as const;

/** "Gasto registrado" + "Mercado, Oct 2026" for one changed record. */
export function describeChangeText(change: SyncRecordChange, t: Translations): ChangeText {
  const records = t.sync.records;
  // Appending a negative expense is how the ledger reverses one.
  const reversed = change.table === 'expenses' && change.op === 'create' && (change.amount ?? 0) < 0;
  const title = reversed ? records.expenses.reversed : phrasesFor(change.table, records)[OP_PHRASE[change.op]];
  return { title, detail: changeDetail(change, t) };
}

function phrasesFor(table: string, records: Translations['sync']['records']): RecordPhrases {
  const byTable: Record<string, RecordPhrases> = records;
  // Own keys only: a table named like an Object.prototype member must not match.
  return Object.hasOwn(byTable, table) ? byTable[table] : records.generic;
}

function changeDetail({ label, month }: SyncRecordChange, t: Translations): string | null {
  const monthText = month ? formatMonth(month, t) : null;
  if (label && monthText) return t.sync.activity.labelWithMonth(label, monthText);
  return label ?? monthText;
}

/** 'YYYY-MM' → "Oct 2026", like the rest of the app. */
function formatMonth(month: string, t: Translations): string {
  const [year, mm] = month.split('-');
  const name = mm ? t.months.short[mm] : undefined;
  return name && year ? `${name} ${year}` : month;
}

/** Exchange rates carry a rate, not money: no currency, so it shows as a number. */
function amountOf(change: SyncRecordChange): Pick<SyncEventItem, 'amount' | 'currency'> {
  if (change.table === 'exchange_rates') return { amount: change.amount, currency: null };
  return { amount: change.amount, currency: change.currency };
}

// ---------------------------------------------------------------------------
// Activity rows
// ---------------------------------------------------------------------------

export type SyncEventIcon = 'upload' | 'download' | 'failed' | 'connected' | 'disconnected' | 'connection-error';
export type SyncEventTone = 'brand' | 'positive' | 'negative' | 'muted';

export interface SyncEventItem extends ChangeText {
  /** Unique within the event (a record can change twice in one batch). */
  key: string;
  amount: number | null;
  /** 'COP' | 'USD' for money; null for plain numbers (exchange rates). */
  currency: string | null;
}

export interface SyncEventRow {
  id: string;
  kind: SyncActivityEvent['kind'];
  icon: SyncEventIcon;
  tone: SyncEventTone;
  title: string;
  detail: string | null;
  /** Failed uploads only: attempts so far, or when a retry got it through. */
  status: { text: string; tone: 'negative' | 'positive' } | null;
  amount: number | null;
  currency: string | null;
  /** Epoch ms. */
  at: number;
  /** 'HH:mm', local time. */
  time: string;
  /** Multi-change events only: the first MAX_ITEMS changes. */
  items?: SyncEventItem[];
  /** Multi-change events only: changes not listed in `items`. */
  moreCount?: number;
}

/** Changes listed under a multi-change row. */
export const MAX_ITEMS = 5;
/** Labels previewed in a multi-change row's detail line. */
const MAX_PREVIEW_LABELS = 3;

/** One activity-log row for the console. */
export function summarizeEvent(event: SyncActivityEvent, t: Translations): SyncEventRow {
  const base = { id: event.id, kind: event.kind, at: event.at, time: formatClockTime(event.at), status: null };

  switch (event.kind) {
    case 'upload':
      return {
        ...base,
        icon: 'upload',
        tone: 'brand',
        ...describeChanges(event.changes, event.changes.length, t.sync.activity.uploaded, t),
      };

    case 'download':
      return {
        ...base,
        icon: 'download',
        tone: 'positive',
        ...describeChanges(event.changes, event.total, t.sync.activity.received, t),
      };

    case 'upload-failed': {
      // Resolved failures stay in the log but stop asking for attention.
      const { resolvedAt } = event;
      return {
        ...base,
        icon: 'failed',
        tone: resolvedAt === null ? 'negative' : 'muted',
        ...describeChanges(event.changes, event.changes.length, t.sync.activity.notUploaded, t),
        status:
          resolvedAt === null
            ? { text: t.sync.activity.failedAttempts(event.attempts), tone: 'negative' }
            : { text: t.sync.activity.resolvedAt(formatClockTime(resolvedAt)), tone: 'positive' },
      };
    }

    case 'connection':
      return {
        ...base,
        icon: CONNECTION_ICONS[event.state],
        tone: 'muted',
        title: t.sync.activity.connection[event.state],
        detail: event.error ? t.sync.errorKinds[event.error.kind] : null,
        amount: null,
        currency: null,
      };
  }
}

const CONNECTION_ICONS = {
  connected: 'connected',
  disconnected: 'disconnected',
  error: 'connection-error',
} as const satisfies Record<Extract<SyncActivityEvent, { kind: 'connection' }>['state'], SyncEventIcon>;

type ChangeSummary = Pick<SyncEventRow, 'title' | 'detail' | 'amount' | 'currency' | 'items' | 'moreCount'>;

/**
 * A single change reads like the change itself; several get a count title
 * (from `total`: downloads keep only part of their changes), a preview of
 * their labels and the first MAX_ITEMS as items.
 */
function describeChanges(
  changes: SyncRecordChange[],
  total: number,
  countTitle: (n: number) => string,
  t: Translations,
): ChangeSummary {
  const [only] = changes;
  if (total === 1 && changes.length === 1 && only) {
    return { ...describeChangeText(only, t), ...amountOf(only) };
  }

  const items = changes.slice(0, MAX_ITEMS).map((change, index) => ({
    key: `${change.id}-${index}`,
    ...describeChangeText(change, t),
    ...amountOf(change),
  }));
  const labels = [...new Set(changes.map((change) => change.label).filter((label) => label !== null))];

  return {
    title: countTitle(total),
    detail: labels.length > 0 ? labels.slice(0, MAX_PREVIEW_LABELS).join(', ') : null,
    amount: null,
    currency: null,
    items,
    moreCount: Math.max(0, total - items.length),
  };
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export type SyncActivityFilter = 'all' | 'uploads' | 'downloads' | 'errors';

export const SYNC_ACTIVITY_FILTERS: readonly SyncActivityFilter[] = ['all', 'uploads', 'downloads', 'errors'];

export function matchesFilter(event: SyncActivityEvent, filter: SyncActivityFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'uploads':
      return event.kind === 'upload' || event.kind === 'upload-failed';
    case 'downloads':
      return event.kind === 'download';
    case 'errors':
      return event.kind === 'upload-failed' || (event.kind === 'connection' && event.state === 'error');
  }
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * "hace 2 minutos" / "2 minutes ago". Under a minute it says "now": the
 * console refreshes this every 30 s, so counting seconds would be stale.
 */
export function relativeTime(ms: number, now: number, locale: string): string {
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'long' });
  const elapsed = Math.max(0, now - ms);
  if (elapsed < MINUTE_MS) return format.format(0, 'second');
  if (elapsed < HOUR_MS) return format.format(-Math.floor(elapsed / MINUTE_MS), 'minute');
  if (elapsed < DAY_MS) return format.format(-Math.floor(elapsed / HOUR_MS), 'hour');
  return format.format(-Math.floor(elapsed / DAY_MS), 'day');
}

/** 'HH:mm' in local time, 24-hour, in every locale. */
export function formatClockTime(ms: number): string {
  const date = new Date(ms);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
