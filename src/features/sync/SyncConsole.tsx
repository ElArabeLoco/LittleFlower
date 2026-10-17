/**
 * SyncConsole — the popover opened from the header's sync button.
 *
 *   Sincronización                      ← hand-written title
 *   (icon) Todo está al día             ← state headline
 *          Última sincronización: …     ← refreshed every 30 s while open
 *   [download progress]
 *   [callout: what went wrong, what to do, technical details]
 *   Actividad de esta sesión + filter + rows (scrolls)
 *   ─────────────────────────────────────
 *   pending count, copy diagnostics, clear log
 *
 * Presentational: everything arrives as props, and it renders the
 * PopoverContent of the popover that SyncStatusButton owns.
 */

import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { SyncActivityEvent, SyncAlert, SyncErrorInfo, SyncHealth } from '@/application/useSyncStatus';
import { useI18n } from '@/shared/i18n/I18nContext';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/ui/cn';
import { PopoverContent } from '@/shared/ui/popover';
import { CopyDiagnosticsButton, RetryButton } from './SyncActionButtons';
import { SyncActivityList } from './SyncActivityList';
import { healthVisual, relativeTime, visibleSyncState } from './syncPresentation';
import { ALERT_ICONS, HEALTH_ICONS, SLOW_SPIN, TONE_TEXT } from './syncVisuals';

/** How often "Última sincronización: hace …" refreshes while the console is open. */
const CLOCK_REFRESH_MS = 30_000;

export interface SyncConsoleProps {
  health: SyncHealth;
  /** This session's activity, newest first. */
  events: SyncActivityEvent[];
  lastSyncedAt: number | null;
  /** 0–1 while a download is in progress, otherwise null. */
  downloadFraction: number | null;
  /** Fixed clock (previews). When omitted the console keeps its own. */
  now?: number;
  onRetry: () => Promise<void>;
  onClearLog: () => void;
  onCopyDiagnostics: () => Promise<void>;
  onSignIn: () => void;
}

export function SyncConsole(props: SyncConsoleProps) {
  const titleId = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const focusPanel = () => contentRef.current?.focus();

  return (
    <PopoverContent
      ref={contentRef}
      aria-labelledby={titleId}
      // Start reading at the title instead of jumping to the first button.
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        focusPanel();
      }}
      className="flex flex-col overflow-hidden"
    >
      {/* Radix mounts the content only while open, so the clock below only ticks then. */}
      <SyncConsoleBody {...props} titleId={titleId} onFocusPanel={focusPanel} />
    </PopoverContent>
  );
}

interface SyncConsoleBodyProps extends SyncConsoleProps {
  titleId: string;
  /** Moves keyboard focus to the panel itself. */
  onFocusPanel: () => void;
}

function SyncConsoleBody({
  health,
  events,
  lastSyncedAt,
  downloadFraction,
  now: fixedNow,
  onRetry,
  onClearLog,
  onCopyDiagnostics,
  onSignIn,
  titleId,
  onFocusPanel,
}: SyncConsoleBodyProps) {
  const { t, locale } = useI18n();
  const now = useClock(fixedNow);

  const state = visibleSyncState(health);
  const { icon, tone } = healthVisual(state, health.alert?.severity);
  const Icon = HEALTH_ICONS[icon];
  const headline = state === 'pending' ? t.sync.pendingChanges(health.pendingCount) : t.sync.headlines[state];

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="px-5 pb-4 pt-5">
          <h2 id={titleId} className="font-hand text-xl font-[650] leading-tight tracking-[-0.01em] text-[var(--text-primary)]">
            {t.sync.title}
          </h2>

          <div className="mt-2.5 flex gap-2.5">
            <span
              aria-hidden="true"
              className={cn('mt-px inline-flex h-5 shrink-0', TONE_TEXT[tone], icon === 'syncing' && SLOW_SPIN.className)}
              style={icon === 'syncing' ? SLOW_SPIN.style : undefined}
            >
              <Icon size={18} strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p role="status" className="text-[15px] font-semibold leading-5 text-[var(--text-primary)]">
                {headline}
              </p>
              {/* Offline is not a problem to solve: one reassuring sentence, no callout. */}
              {health.alert?.kind === 'offline' && (
                <p className="mt-0.5 text-[13px] leading-5 text-[var(--text-secondary)]">{t.sync.alerts.offline.body}</p>
              )}
              <p className="mt-0.5 text-[13px] leading-5 text-[var(--text-muted)]">
                {lastSyncedAt === null
                  ? t.sync.neverSynced
                  : t.sync.lastSynced(relativeTime(lastSyncedAt, now, locale))}
              </p>
              {downloadFraction !== null && <DownloadProgress fraction={downloadFraction} />}
            </div>
          </div>
        </div>

        {health.alert && health.alert.kind !== 'offline' && (
          <SyncCallout
            kind={health.alert.kind}
            severity={health.alert.severity}
            error={health.error}
            onRetry={onRetry}
            onCopyDiagnostics={onCopyDiagnostics}
            onSignIn={onSignIn}
          />
        )}

        <SyncActivityList events={events} />
      </div>

      <div className="shrink-0 border-t border-[var(--border-subtle)] px-5 pb-2 pt-3">
        <p className="text-xs leading-[18px] text-[var(--text-secondary)]">{t.sync.pendingChanges(health.pendingCount)}</p>
        <div className="-mx-3 mt-1 flex flex-wrap items-center">
          <CopyDiagnosticsButton variant="ghost" onCopy={onCopyDiagnostics} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={events.length === 0}
            onClick={() => {
              onClearLog();
              // The button disables itself; keep keyboard focus inside the console.
              onFocusPanel();
            }}
          >
            {t.sync.actions.clearLog}
          </Button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Clock
// ---------------------------------------------------------------------------

/** Current time, refreshed every CLOCK_REFRESH_MS while mounted (the popover only mounts while open). */
function useClock(fixedNow: number | undefined): number {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (fixedNow !== undefined) return;
    const timer = setInterval(() => setNow(Date.now()), CLOCK_REFRESH_MS);
    return () => clearInterval(timer);
  }, [fixedNow]);

  return fixedNow ?? now;
}

// ---------------------------------------------------------------------------
// Download progress
// ---------------------------------------------------------------------------

function DownloadProgress({ fraction }: { fraction: number }) {
  const { t } = useI18n();
  const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100);

  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between text-xs text-[var(--text-secondary)]">
        <span>{t.sync.downloadProgress}</span>
        <span className="tabular-nums">{t.sync.downloadPercent(percent)}</span>
      </div>
      <div
        role="progressbar"
        aria-label={t.sync.downloadProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--bg-surface-2)]"
      >
        <div
          className="h-full rounded-full bg-green-600 transition-[width] duration-300 dark:bg-green-400"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Callout
// ---------------------------------------------------------------------------

const CALLOUT_STYLES: Record<SyncAlert['severity'], string> = {
  error: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/70 dark:bg-red-950/45 dark:text-red-100',
  warning: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/45 dark:text-amber-100',
  info: 'border-[var(--border-subtle)] bg-[var(--bg-surface-2)] text-[var(--text-secondary)]',
};

interface SyncCalloutProps {
  kind: Exclude<SyncAlert['kind'], 'offline'>;
  severity: SyncAlert['severity'];
  error: SyncErrorInfo | null;
  onRetry: () => Promise<void>;
  onCopyDiagnostics: () => Promise<void>;
  onSignIn: () => void;
}

/**
 * What went wrong in plain words, then what to do, then the technical
 * details. A band across the console, its text on the same margin line as
 * the headline and the log rows.
 *
 * At most two actions, the one that helps first:
 *   upload-rejected → copy diagnostics, retry (retrying cannot undo a rejection)
 *   auth            → sign in, retry
 *   connection      → retry
 * The footer keeps "copy diagnostics" for every state.
 */
function SyncCallout({ kind, severity, error, onRetry, onCopyDiagnostics, onSignIn }: SyncCalloutProps) {
  const { t } = useI18n();
  const titleId = useId();
  const copy = t.sync.alerts[kind];
  const Icon = ALERT_ICONS[kind];

  return (
    <section
      aria-labelledby={titleId}
      className={cn('mb-4 flex gap-2.5 border-y px-5 py-3.5', CALLOUT_STYLES[severity])}
    >
      <Icon size={18} strokeWidth={2} aria-hidden="true" className="mt-px shrink-0" />
      <div className="min-w-0 flex-1">
        <h3 id={titleId} className="text-sm font-semibold leading-5">
          {copy.title}
        </h3>
        <p className="mt-1 text-[13px] leading-5">{copy.body}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          {kind === 'upload-rejected' && (
            <CopyDiagnosticsButton variant="default" withIcon={false} onCopy={onCopyDiagnostics} />
          )}
          {kind === 'auth' && (
            <Button type="button" size="sm" onClick={onSignIn}>
              {t.sync.actions.signIn}
            </Button>
          )}
          <RetryButton
            onRetry={onRetry}
            label={t.sync.actions.retryNow}
            variant={kind === 'connection' ? 'default' : 'outline'}
            withIcon={false}
          />
        </div>

        {error && <TechnicalDetails error={error} />}
      </div>
    </section>
  );
}

function TechnicalDetails({ error }: { error: SyncErrorInfo }) {
  const { t } = useI18n();
  const labels = t.sync.technical;
  const fields: [string, string | number | null][] = [
    [labels.kind, error.kind],
    [labels.code, error.code],
    [labels.status, error.status],
    [labels.table, error.table],
    [labels.op, error.op],
    [labels.recordId, error.recordId],
    [labels.message, error.message],
  ];

  return (
    <details className="group mt-3 text-xs leading-[18px]">
      <summary className="-mx-1 inline-flex cursor-pointer list-none items-center gap-1 rounded-md px-1 font-semibold [&::-webkit-details-marker]:hidden">
        <ChevronRight size={14} aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-90" />
        {labels.summary}
      </summary>
      <dl className="mt-1.5 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 pl-[18px]">
        {fields
          .filter(([, value]) => value !== null && value !== '')
          .map(([label, value]) => (
            <Fragment key={label}>
              <dt className="opacity-75">{label}</dt>
              <dd className="break-words">{value}</dd>
            </Fragment>
          ))}
      </dl>
    </details>
  );
}
