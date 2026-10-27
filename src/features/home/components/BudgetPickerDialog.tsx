/**
 * BudgetPickerDialog — first step of "Record expense" from Home: choose the
 * budget item the expense belongs to. The caller then opens ExpenseFormDialog
 * for that item. A search field appears when the list is long.
 */

import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { MonthBudget } from '@/application/homeSummary';
import { useI18n } from '@/shared/i18n/useI18n';
import { buttonVariants } from '@/shared/ui/buttonVariants';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';

const SEARCH_THRESHOLD = 8;

interface BudgetPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgets: MonthBudget[];
  onPick: (budget: MonthBudget) => void;
}

export function BudgetPickerDialog({ open, onOpenChange, budgets, onPick }: BudgetPickerDialogProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');

  const sorted = useMemo(
    () => [...budgets].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [budgets],
  );
  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('es');
    return q ? sorted.filter(b => b.name.toLocaleLowerCase('es').includes(q)) : sorted;
  }, [sorted, query]);

  function handleOpenChange(next: boolean) {
    if (!next) setQuery('');
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="budget-picker-desc">
        <DialogHeader>
          <DialogTitle>{t.home.registerExpense}</DialogTitle>
          <p id="budget-picker-desc" className="text-sm text-[var(--text-secondary)]">{t.home.pickBudgetDesc}</p>
        </DialogHeader>

        {budgets.length === 0 ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-[15px] text-[var(--text-secondary)]">{t.home.noBudgets}</p>
            <Link to="/settings/budgets" className={buttonVariants()}>{t.home.createBudgets}</Link>
          </div>
        ) : (
          <>
            {budgets.length > SEARCH_THRESHOLD && (
              <Input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t.home.searchBudget}
                aria-label={t.home.searchBudget}
              />
            )}
            <ul className="-mx-2 flex max-h-[50dvh] flex-col overflow-y-auto">
              {visible.map(budget => (
                <li key={budget.id}>
                  <button
                    type="button"
                    onClick={() => onPick(budget)}
                    className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-[15px] font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
                  >
                    <span className="min-w-0 truncate">{budget.name}</span>
                  </button>
                </li>
              ))}
              {visible.length === 0 && (
                <li className="px-3 py-2 text-sm text-[var(--text-muted)]">{t.home.noBudgetMatch}</li>
              )}
            </ul>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
