/**
 * MonthSummaryCard — the current month at a glance: real balance, the petal
 * meter of budget executed (always with the percentage in words) and the four
 * figures of the month view.
 *
 *   ┌───────────────────────────────────────────────┐
 *   │ Octubre 2026 (• Mes actual)        Ver el mes > │
 *   │ Balance real                            ✿✿    │
 *   │ +$4.284.000                            ✿ ✿    │
 *   │ 70% del presupuesto ejecutado                  │
 *   │ ───────────────────────────────────────────── │
 *   │ Disponible  Presupuestado  Ejecutado  Por ejec. │
 *   └───────────────────────────────────────────────┘
 */

import { Link } from '@tanstack/react-router';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import type { MonthBalance } from '@/application/homeSummary';
import { useI18n } from '@/shared/i18n/useI18n';
import { AbbreviatedAmount } from '@/shared/ui/AbbreviatedAmount';
import { cn } from '@/shared/ui/cn';
import { PetalMeter } from '@/shared/ui/PetalMeter';

interface MonthSummaryCardProps {
  monthLabel: string;
  balance: MonthBalance;
  hasMissingTrm: boolean;
}

/** Ledger ink: negative amounts in brick, everything else in plum ink (as in the month view). */
function inkFor(value: number) {
  return value < 0 ? 'text-[var(--text-negative)]' : 'text-[var(--text-primary)]';
}

export function MonthSummaryCard({ monthLabel, balance, hasMissingTrm }: MonthSummaryCardProps) {
  const { t } = useI18n();
  const pct = Math.round(balance.executedRatio * 100);
  const progressText = balance.budgeted > 0 ? t.home.executedPct(pct) : t.home.nothingBudgeted;

  const stats = [
    { label: t.dashboard.available, value: balance.available },
    { label: t.dashboard.budgeted, value: balance.budgeted },
    { label: t.dashboard.spent, value: balance.executed },
    { label: t.dashboard.toSpend, value: balance.toExecute },
  ];

  return (
    <section
      aria-labelledby="home-month-title"
      className="flex min-w-0 flex-col gap-6 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="home-month-title" className="text-xl font-[720] tracking-[-0.01em]">{monthLabel}</h2>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-amber-500" />
            {t.home.currentMonth}
          </span>
        </div>
        <Link
          to="/month"
          className="inline-flex min-h-10 items-center gap-1 rounded-lg text-sm font-semibold text-[var(--text-brand)] hover:underline"
        >
          {t.home.seeMonth}
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </div>

      <div className="flex items-center gap-4 sm:gap-8">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--text-secondary)]">{t.monthView.trueBalanceReal}</p>
          <p
            className={cn(
              'mt-1 text-[32px] font-[820] leading-none tracking-[-0.035em] tabular-nums sm:text-[48px] lg:text-[56px]',
              inkFor(balance.realBalance),
            )}
          >
            {balance.realBalance > 0 ? '+' : ''}
            <AbbreviatedAmount value={balance.realBalance} />
          </p>
          <p className="mt-2 text-[13px] text-[var(--text-muted)]">{t.monthView.availableMinusSpent}</p>
          <p className="mt-4 text-[15px] font-bold sm:text-base">{progressText}</p>
        </div>
        <PetalMeter
          value={balance.executedRatio}
          label={progressText}
          className="size-28 shrink-0 sm:size-40 lg:size-44"
        />
      </div>

      {hasMissingTrm && (
        <p className="flex items-start gap-2 rounded-[10px] bg-amber-50 px-3 py-2 text-[13px] leading-snug text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true" className="mt-px shrink-0" />
          <span>
            {t.monthView.usdExcludedNoTrm}{' '}
            <Link to="/income" className="font-semibold underline">{t.home.addTrm}</Link>
          </span>
        </p>
      )}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[var(--border-subtle)] pt-5 sm:grid-cols-4">
        {stats.map(stat => (
          <div key={stat.label} className="min-w-0">
            <dt className="text-[13px] text-[var(--text-secondary)]">{stat.label}</dt>
            <dd className={cn('mt-0.5 text-base font-bold tabular-nums sm:text-lg', inkFor(stat.value))}>
              <AbbreviatedAmount value={stat.value} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
