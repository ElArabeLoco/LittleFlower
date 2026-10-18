import { useI18n } from '@/shared/i18n/I18nContext';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { cn } from '@/shared/ui/cn';
import type { YearLens } from '@/application/yearViewLens';

export interface StatusCell {
  budgetName: string;
  monthLabel: string;
  started: boolean;
  planned: number;
  spent: number;
  executed: boolean;
  /** month relative to the current one */
  when: 'past' | 'current' | 'future';
}

export interface StatusRange {
  sum: number;
  average: number;
  count: number;
}

interface YearViewStatusBarProps {
  lens: YearLens;
  /** Exactly one cell selected. */
  cell: StatusCell | null;
  /** More than one cell selected. */
  range: StatusRange | null;
}

function Swatch({ className }: { className: string }) {
  return <span aria-hidden="true" className={cn('h-3.5 w-5 rounded-sm', className)} />;
}

/** Bottom bar: selection details (single cell), sum/average (range) or the color legend. */
export function YearViewStatusBar({ lens, cell, range }: YearViewStatusBarProps) {
  const { t } = useI18n();
  const { formatCOP } = useNumberFormat();
  const y = t.yearView;

  let body: React.ReactNode;
  if (cell) {
    const over = cell.spent > cell.planned;
    const pct = cell.planned > 0 && cell.spent > 0 ? ` (${Math.round((cell.spent / cell.planned) * 100)} %)` : '';
    let state = y.statusPlanned;
    if (cell.executed) state = y.statusPaid;
    else if (over) state = y.statusOverBy(formatCOP(cell.spent - cell.planned));
    else if (cell.when !== 'future') state = y.statusPending;
    body = cell.started ? (
      <>
        <span className="font-semibold text-[var(--text-primary)]">{cell.budgetName} · {cell.monthLabel}</span>
        <span>{y.budgetedRow} {formatCOP(cell.planned)}</span>
        <span>{y.executedRow} {formatCOP(cell.spent)}{pct}</span>
        <span className={cn('font-semibold', over && !cell.executed && 'text-[var(--text-negative)]')}>{state}</span>
      </>
    ) : (
      <>
        <span className="font-semibold text-[var(--text-primary)]">{cell.budgetName} · {cell.monthLabel}</span>
        <span>{y.statusNotStarted}</span>
      </>
    );
  } else if (range) {
    body = (
      <>
        <span className="font-semibold text-[var(--text-primary)]">{y.statusSum} {formatCOP(range.sum)}</span>
        <span>{y.statusAverage} {formatCOP(range.average)}</span>
        <span>{y.statusCells(range.count)}</span>
      </>
    );
  } else {
    body = (
      <>
        {lens === 'plan' && (
          <>
            <span className="inline-flex items-center gap-1.5"><Swatch className="border border-[var(--border-subtle)] bg-green-50 dark:bg-green-950/40" />{y.legendPaid}</span>
            <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="font-semibold text-[var(--text-negative)]">{formatCOP(800_000)}</span>{y.legendOver}</span>
          </>
        )}
        {lens === 'spent' && (
          <>
            <span className="inline-flex items-center gap-1.5"><Swatch className="bg-green-500/25" />{y.legendBar}</span>
            <span className="inline-flex items-center gap-1.5"><Swatch className="bg-red-500/25" />{y.legendOver}</span>
          </>
        )}
        {lens === 'diff' && (
          <>
            <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="font-semibold text-[var(--text-positive)]">+{formatCOP(200_000)}</span>{y.legendSaved}</span>
            <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="font-semibold text-[var(--text-negative)]">{formatCOP(-300_000)}</span>{y.legendOver}</span>
          </>
        )}
        <span className="inline-flex items-center gap-1.5"><Swatch className="bg-[var(--color-now)]/[0.12]" />{y.legendCurrent}</span>
      </>
    );
  }

  return (
    <div
      role="status"
      className="flex min-h-9 flex-wrap items-center gap-x-5 gap-y-1 border-t border-[var(--border-medium)] bg-[var(--bg-surface)] px-4 py-1.5 text-xs tabular-nums text-[var(--text-secondary)]"
    >
      {body}
      <span className="ml-auto text-[var(--text-muted)]">{lens === 'plan' ? y.selectHint : y.editInPlanLens}</span>
    </div>
  );
}
