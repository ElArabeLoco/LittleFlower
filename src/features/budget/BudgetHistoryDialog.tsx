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

/** 'YYYY-MM-DD…' as '03 oct 2026', with the active language's month names. */
function formatDate(timestamp: string, months: Parameters<typeof formatMonthLabel>[1]): string {
  return `${timestamp.slice(8, 10)} ${formatMonthLabel(timestamp.slice(0, 7), months, 'short')}`;
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
  const rows = page.flatMap(group => group.rows);

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

      <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-surface-2)] text-xs text-[var(--text-muted)]">
            <tr>
              <th scope="col" className="py-2 pl-3 pr-2 text-left font-semibold">{t.transactions.dateHeader}</th>
              <th scope="col" className="px-2 py-2 text-left font-semibold">{t.transactions.noteHeader}</th>
              <th scope="col" className="py-2 pl-2 pr-3 text-right font-semibold">{t.transactions.amountHeader}</th>
            </tr>
          </thead>
          {/* Baselines line up when a long description wraps. */}
          <tbody className="[&_td]:align-baseline">
            {rows.map(r => {
              const isCurrent = r.month === currentMonth;
              return (
                // The current month carries the year view's tint and a bolder date.
                <tr key={r.id} className={cn('border-t border-[var(--border-subtle)]', isCurrent && 'bg-[var(--color-now)]/[0.07]')}>
                  <td className={cn(
                    'whitespace-nowrap py-2.5 pl-3 pr-2 text-xs tabular-nums',
                    isCurrent ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]',
                  )}>
                    {formatDate(r.timestamp, t.months)}
                  </td>
                  <td className="w-full break-words px-2 py-2.5 text-[var(--text-secondary)]">
                    {r.note ?? <span className="text-[var(--text-muted)]">—</span>}
                    {showMode && (
                      <span className="text-xs text-[var(--text-muted)]">
                        {' · '}{r.paid_with_credit_card === 1 ? t.budgets.cardMethod : t.budgets.cashMethod}
                      </span>
                    )}
                  </td>
                  <td className={cn(
                    'whitespace-nowrap py-2.5 pl-2 pr-3 text-right font-medium tabular-nums',
                    r.amount < 0 ? 'text-rose-500' : 'text-[var(--text-primary)]',
                  )}>
                    {formatCOP(r.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
