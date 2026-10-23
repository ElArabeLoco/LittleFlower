/**
 * PendingBudgetsCard — budget items not yet executed this month, largest
 * first, each with the month view's "mark as executed" action.
 */

import { Link } from '@tanstack/react-router';
import { CircleCheck } from 'lucide-react';
import type { MonthBudget } from '@/application/homeSummary';
import type { PaymentMode } from '@/domain/budget/Budget';
import { useI18n } from '@/shared/i18n/I18nContext';
import { AbbreviatedAmount } from '@/shared/ui/AbbreviatedAmount';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/ui/cn';

const MODE_INK: Record<PaymentMode, string> = {
  cash: 'text-green-700 dark:text-green-300',
  credit_card: 'text-violet-700 dark:text-violet-300',
  both: 'text-[var(--text-secondary)]',
};

interface PendingBudgetsCardProps {
  items: MonthBudget[];
  /** Pending items not listed here. */
  moreCount: number;
  totalText: string;
  busyId: string | null;
  error: string | null;
  onMarkExecuted: (item: MonthBudget) => void;
}

export function PendingBudgetsCard({ items, moreCount, totalText, busyId, error, onMarkExecuted }: PendingBudgetsCardProps) {
  const { t } = useI18n();
  const modeLabel: Record<PaymentMode, string> = {
    cash: t.monthView.cashLabel,
    credit_card: t.monthView.creditCard,
    both: t.home.modeBoth,
  };

  return (
    <section
      aria-labelledby="home-pending-title"
      className="flex min-w-0 flex-col rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="home-pending-title" className="text-xl font-[720] tracking-[-0.01em]">{t.home.pendingTitle}</h2>
        {items.length > 0 && <span className="text-sm font-semibold tabular-nums text-[var(--text-secondary)]">{totalText}</span>}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-[10px] bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 text-[15px] text-[var(--text-secondary)]">
          <CircleCheck size={18} aria-hidden="true" className="text-[var(--text-positive)]" />
          {t.home.pendingEmpty}
        </p>
      ) : (
        <ul className="mt-3">
          {items.map(item => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[var(--border-subtle)] py-3 first:border-t-0 sm:flex-nowrap"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{item.name}</span>
                <span className={cn('block text-xs font-medium', MODE_INK[item.paymentMode])}>{modeLabel[item.paymentMode]}</span>
              </span>
              <AbbreviatedAmount value={item.amount} className="text-[15px] font-bold tabular-nums" />
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                disabled={busyId === item.id}
                onClick={() => onMarkExecuted(item)}
              >
                {t.monthView.markExecuted}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {moreCount > 0 && (
        <Link to="/month" className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-[var(--text-brand)] hover:underline">
          {t.home.pendingMore(moreCount)}
        </Link>
      )}
    </section>
  );
}
