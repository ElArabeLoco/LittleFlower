/**
 * SyncActivityList — this session's sync log inside the console.
 *
 * A filter (all / uploads / downloads / errors) over ledger-like rows,
 * newest first: margin icon, what happened, the amount and the time. Rows
 * that carry several changes open to list them.
 */

import { useId, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { SyncActivityEvent } from '@/application/useSyncStatus';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { useI18n } from '@/shared/i18n/useI18n';
import { cn } from '@/shared/ui/cn';
import {
  SYNC_ACTIVITY_FILTERS,
  matchesFilter,
  summarizeEvent,
  type SyncActivityFilter,
  type SyncEventRow,
} from './syncPresentation';
import { EVENT_ICONS, TONE_TEXT } from './syncVisuals';

type FormatAmount = (amount: number, currency: string | null) => string;

interface SyncActivityListProps {
  /** Newest first. */
  events: SyncActivityEvent[];
}

export function SyncActivityList({ events }: SyncActivityListProps) {
  const { t } = useI18n();
  const titleId = useId();
  const [filter, setFilter] = useState<SyncActivityFilter>('all');
  const { formatCOP, formatUSD, formatNumber } = useNumberFormat();

  const rows = useMemo(
    () => events.filter((event) => matchesFilter(event, filter)).map((event) => summarizeEvent(event, t)),
    [events, filter, t],
  );

  const formatAmount: FormatAmount = (amount, currency) => {
    if (currency === 'COP') return formatCOP(amount);
    if (currency === 'USD') return formatUSD(amount);
    return currency ? `${formatNumber(amount)} ${currency}` : formatNumber(amount);
  };

  return (
    <section aria-labelledby={titleId}>
      {/* Stays in view while the rows scroll under it. */}
      <div className="sticky top-0 z-10 bg-[var(--bg-surface)] px-5 pb-3 pt-1">
        <h3 id={titleId} className="text-[13px] font-semibold text-[var(--text-secondary)]">
          {t.sync.activity.title}
        </h3>
        {/* Nothing to filter in an empty log. */}
        <div
          role="group"
          aria-label={t.sync.activity.filterLabel}
          hidden={events.length === 0}
          className="mt-2 grid grid-cols-4 gap-0.5 rounded-[10px] bg-[var(--bg-surface-2)] p-0.5"
        >
          {SYNC_ACTIVITY_FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={filter === option}
              onClick={() => setFilter(option)}
              className={cn(
                'h-8 min-w-0 truncate rounded-lg px-1 text-[13px] transition-colors focus-visible:-outline-offset-2',
                filter === option
                  ? 'bg-[var(--bg-surface)] font-semibold text-[var(--text-primary)] shadow-[0_1px_2px_rgb(46_28_40/0.1)] dark:bg-[var(--border-medium)]'
                  : 'font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              )}
            >
              {t.sync.activity.filters[option]}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-6 pb-8 pt-5 text-center text-[13px] leading-relaxed text-[var(--text-muted)]">
          {events.length === 0 ? t.sync.activity.empty : t.sync.activity.emptyFilter}
        </p>
      ) : (
        <ol className="divide-y divide-[var(--border-subtle)] px-5 pb-2">
          {rows.map((row) => (
            <ActivityRow key={row.id} row={row} formatAmount={formatAmount} />
          ))}
        </ol>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function ActivityRow({ row, formatAmount }: { row: SyncEventRow; formatAmount: FormatAmount }) {
  const { t } = useI18n();
  const itemsId = useId();
  const [expanded, setExpanded] = useState(false);
  const Icon = EVENT_ICONS[row.icon];
  const items = row.items ?? [];
  const moreCount = row.moreCount ?? 0;
  const expandable = items.length > 0;

  const title = (
    <>
      {/* The icon tells the direction visually; screen readers hear it first. */}
      <span className="sr-only">{t.sync.activity.kinds[row.kind]}: </span>
      {row.title}
    </>
  );

  return (
    <li className="flex gap-3 py-3">
      <Icon size={16} strokeWidth={2.25} aria-hidden="true" className={cn('mt-0.5 shrink-0', TONE_TEXT[row.tone])} />

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {expandable ? (
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={itemsId}
                onClick={() => setExpanded((open) => !open)}
                className="-mx-1 inline-flex max-w-full items-center gap-1 rounded-md px-1 text-left text-[13px] font-semibold leading-5 text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              >
                <span className="min-w-0">{title}</span>
                <ChevronDown
                  size={14}
                  aria-hidden="true"
                  className={cn('shrink-0 text-[var(--text-muted)] transition-transform', expanded && 'rotate-180')}
                />
              </button>
            ) : (
              <p className="text-[13px] font-semibold leading-5 text-[var(--text-primary)]">{title}</p>
            )}
            {row.detail && (
              <p className="line-clamp-2 break-words text-xs leading-[18px] text-[var(--text-secondary)]">{row.detail}</p>
            )}
            {row.status && (
              <p className={cn('mt-0.5 text-xs font-medium leading-[18px]', TONE_TEXT[row.status.tone])}>
                {row.status.text}
              </p>
            )}
          </div>

          <div className="shrink-0 text-right">
            {row.amount !== null && (
              <p className="text-[13px] font-semibold leading-5 text-[var(--text-primary)] tabular-nums">
                {formatAmount(row.amount, row.currency)}
              </p>
            )}
            <p className="text-xs leading-[18px] text-[var(--text-muted)] tabular-nums">
              <time dateTime={new Date(row.at).toISOString()}>{row.time}</time>
            </p>
          </div>
        </div>

        {expandable && (
          <ul
            id={itemsId}
            hidden={!expanded}
            className="mt-2 space-y-1.5 border-l-2 border-[var(--border-subtle)] pl-3"
          >
            {items.map((item) => (
              <li key={item.key} className="flex items-start gap-3 text-xs leading-[18px]">
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-[var(--text-primary)]">{item.title}</span>
                  {item.detail && <span className="block break-words text-[var(--text-secondary)]">{item.detail}</span>}
                </span>
                {item.amount !== null && (
                  <span className="shrink-0 font-medium text-[var(--text-primary)] tabular-nums">
                    {formatAmount(item.amount, item.currency)}
                  </span>
                )}
              </li>
            ))}
            {moreCount > 0 && <li className="text-xs text-[var(--text-muted)]">{t.sync.activity.more(moreCount)}</li>}
          </ul>
        )}
      </div>
    </li>
  );
}
