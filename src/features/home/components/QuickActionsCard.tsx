/**
 * QuickActionsCard — the two things people come to do most: record an
 * expense (opens the budget picker) and record income. Shows the month's TRM
 * when there is one.
 */

import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { Button, buttonVariants } from '@/shared/ui/button';

interface QuickActionsCardProps {
  onRecordExpense: () => void;
  /** "TRM de octubre: $4.180", or null when the month has no rate. */
  trmText: string | null;
}

export function QuickActionsCard({ onRecordExpense, trmText }: QuickActionsCardProps) {
  const { t } = useI18n();

  return (
    <section
      aria-labelledby="home-actions-title"
      className="flex min-w-0 flex-col gap-3 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-7"
    >
      <h2 id="home-actions-title" className="mb-1 text-xl font-[720] tracking-[-0.01em]">{t.home.register}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <Button size="lg" onClick={onRecordExpense}>
          <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
          {t.home.registerExpense}
        </Button>
        <Link to="/income" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          {t.home.registerIncome}
        </Link>
      </div>
      {trmText && (
        <p className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl bg-[var(--bg-surface-2)] px-4 py-3 text-sm">
          <span className="font-semibold tabular-nums text-[var(--text-secondary)]">{trmText}</span>
          <Link to="/income" className="font-semibold text-[var(--text-brand)] hover:underline">{t.home.changeTrm}</Link>
        </p>
      )}
    </section>
  );
}
