import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/ui/cn';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/ui/dialog';
import { useBudgetExpenseHistory, type BudgetHistoryPage } from '@/application/useBudgetExpenseHistory';
import { formatMonthLabel, type BudgetRow } from './types';

interface BudgetHistoryDialogProps {
  budget: BudgetRow;
  trigger: React.ReactNode;
}

/** Every expense of a partida, in pages of whole months, opening on the current month's page. */
export function BudgetHistoryDialog({ budget, trigger }: BudgetHistoryDialogProps) {
  const { t } = useI18n();

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.budgets.historyTitle(budget.name)}</DialogTitle>
        </DialogHeader>
        <BudgetHistory budgetId={budget.id} showMode={budget.payment_mode === 'both'} />
      </DialogContent>
    </Dialog>
  );
}

/** 'YYYY-MM-DD…' as 'DD/MM'. */
function formatDay(timestamp: string): string {
  const [, m, d] = timestamp.slice(0, 10).split('-');
  return `${d}/${m}`;
}

function BudgetHistory({ budgetId, showMode }: { budgetId: string; showMode: boolean }) {
  const { pages, initialPage, currentMonth, isLoading } = useBudgetExpenseHistory(budgetId);
  if (isLoading) return null;
  return <BudgetHistoryView pages={pages} initialPage={initialPage} currentMonth={currentMonth} showMode={showMode} />;
}

interface BudgetHistoryViewProps {
  pages: BudgetHistoryPage[];
  initialPage: number;
  currentMonth: string;
  /** Dual partidas show the payment mode of each expense. */
  showMode: boolean;
}

export function BudgetHistoryView({ pages, initialPage, currentMonth, showMode }: BudgetHistoryViewProps) {
  const { t } = useI18n();
  const { formatCOP } = useNumberFormat();
  // Null until the user pages, so a live update that moves the current month moves the view too.
  const [chosenPage, setChosenPage] = useState<number | null>(null);

  if (pages.length === 0) {
    return <p className="py-6 text-center text-sm text-[var(--text-muted)]">{t.budgets.historyEmpty}</p>;
  }

  const index = Math.min(chosenPage ?? initialPage, pages.length - 1);
  const page = pages[index];
  const range = [page[0].month, page[page.length - 1].month]
    .map(m => formatMonthLabel(m, t.months, 'short'))
    .filter((label, i, all) => all.indexOf(label) === i)
    .join(' – ');

  return (
    <div className="flex flex-col gap-4">
      {pages.length > 1 && (
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="icon" aria-label={t.budgets.historyPrev} title={t.budgets.historyPrev}
            disabled={index === 0} onClick={() => setChosenPage(index - 1)}>
            <ChevronLeft size={18} />
          </Button>
          <p className="text-center">
            <span className="block text-sm font-semibold text-[var(--text-primary)]">{range}</span>
            <span className="block text-xs tabular-nums text-[var(--text-muted)]">{t.budgets.historyPage(index + 1, pages.length)}</span>
          </p>
          <Button variant="ghost" size="icon" aria-label={t.budgets.historyNext} title={t.budgets.historyNext}
            disabled={index === pages.length - 1} onClick={() => setChosenPage(index + 1)}>
            <ChevronRight size={18} />
          </Button>
        </div>
      )}

      {page.map(group => (
        <section key={group.month}>
          <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border-medium)] pb-1.5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              {formatMonthLabel(group.month, t.months, 'full')}
              {group.month === currentMonth && (
                <span className="rounded-full bg-violet-50 px-2 py-px text-[11px] font-semibold text-violet-800 dark:bg-violet-950/50 dark:text-violet-200">
                  {t.budgets.historyCurrentMonth}
                </span>
              )}
            </h3>
            <span className={cn('text-sm font-semibold tabular-nums', group.total < 0 && 'text-rose-500')}>
              {formatCOP(group.total)}
            </span>
          </div>
          <ul>
            {group.rows.map(r => (
              <li key={r.id} className="flex items-baseline gap-3 border-b border-[var(--border-subtle)] py-2 text-sm last:border-b-0">
                <span className="w-11 shrink-0 tabular-nums text-[var(--text-muted)]">{formatDay(r.timestamp)}</span>
                <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">
                  {r.note ?? <span className="text-[var(--text-muted)]">—</span>}
                  {showMode && (
                    <span className="text-xs text-[var(--text-muted)]">
                      {' · '}{r.paid_with_credit_card === 1 ? t.budgets.cardMethod : t.budgets.cashMethod}
                    </span>
                  )}
                </span>
                <span className={cn('shrink-0 font-medium tabular-nums', r.amount < 0 ? 'text-rose-500' : 'text-[var(--text-primary)]')}>
                  {formatCOP(r.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
