/**
 * SpendingViewSwitch — the Gastos tab's Mes · Año switch.
 *
 * A recessed track whose raised notch marks the current view (the tactile
 * tokens of index.css). Each side is a link. A labelled group, not a <nav>:
 * the bottom bar stays the page's only navigation landmark.
 */

import { Link } from '@tanstack/react-router';
import { useI18n } from '@/shared/i18n/I18nContext';
import { cn } from './cn';

type SpendingView = 'month' | 'year';

const VIEWS: { view: SpendingView; to: '/month' | '/anual' }[] = [
  { view: 'month', to: '/month' },
  { view: 'year', to: '/anual' },
];

export function SpendingViewSwitch({ current }: { current: SpendingView }) {
  const { t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t.spendingViews.label}
      className="inline-flex items-center gap-0.5 rounded-full bg-[var(--tactile-track)] p-[3px] [box-shadow:var(--tactile-track-shadow)]"
    >
      {VIEWS.map(({ view, to }) => {
        const isCurrent = view === current;
        return (
          <Link
            key={view}
            to={to}
            activeOptions={{ exact: true, includeSearch: false }}
            aria-current={isCurrent ? 'page' : undefined}
            className={cn(
              'flex h-9 min-w-14 items-center justify-center rounded-full px-3.5 text-[13px] font-bold transition-[background,box-shadow,color] duration-150',
              'focus-visible:-outline-offset-2',
              isCurrent
                ? 'bg-gradient-to-b from-[var(--tactile-key-top)] to-[var(--tactile-key-bottom)] text-[var(--text-primary)] [box-shadow:var(--tactile-notch-shadow)]'
                : 'text-[var(--tactile-ink-soft)] hover:text-[var(--text-primary)]',
            )}
          >
            {t.spendingViews[view]}
          </Link>
        );
      })}
    </div>
  );
}
