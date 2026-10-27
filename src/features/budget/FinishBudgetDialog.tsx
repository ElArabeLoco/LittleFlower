import { useState } from 'react';
import { useI18n } from '@/shared/i18n/useI18n';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/ui/dialog';
import { getCurrentMonth, nextMonth } from '@/shared/helpers';
import { finishBounds, rangeViolation, BudgetExpenseRangeError } from '@/domain/budget/budgetLifecycle';
import { useBudgetMutations } from '@/application/useBudgetMutations';
import { formatMonthLabel, rangeErrorMessage, type BudgetRow, type ExpenseSpan } from './types';

interface FinishBudgetDialogProps {
  budget: BudgetRow;
  expenseSpan: ExpenseSpan | null;
  householdId: string;
  userId: string;
  trigger: React.ReactNode;
}

/** Sets the last active month of a partida. Earlier months and expenses stay untouched. */
export function FinishBudgetDialog({ budget, expenseSpan, householdId, userId, trigger }: FinishBudgetDialogProps) {
  const { t } = useI18n();
  const { finishBudget } = useBudgetMutations(householdId, userId);
  const bounds = finishBounds(budget.start_month, expenseSpan, getCurrentMonth());
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(bounds.initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (v) setMonth(bounds.initial);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!month || month < budget.start_month) { setError(t.budgets.validationEndMonth); return; }
    const violation = rangeViolation(budget.start_month, month, expenseSpan);
    if (violation) {
      setError(t.budgets.rangeEndError(formatMonthLabel(violation.limit, t.months, 'short')));
      return;
    }
    setBusy(true);
    try {
      await finishBudget(budget.id, month);
      setOpen(false);
    } catch (err) {
      setError(err instanceof BudgetExpenseRangeError ? rangeErrorMessage(err, t) : t.common.unexpectedError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.budgets.finishTitle(budget.name)}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="b-finish-month">{t.budgets.finishLastMonth}</Label>
            <Input id="b-finish-month" type="month" value={month} min={bounds.min}
              onChange={e => setMonth(e.target.value)} />
          </div>
          {month && (
            <p className="text-sm text-[var(--text-secondary)]">
              {t.budgets.finishEffect(formatMonthLabel(nextMonth(month), t.months, 'full'))}
            </p>
          )}
          {expenseSpan && (
            <p className="text-sm text-[var(--text-muted)]">
              {t.budgets.finishHasExpenses(formatMonthLabel(expenseSpan.last, t.months, 'full'))}
            </p>
          )}
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" className="flex-1" disabled={busy}>
              {busy ? t.common.saving : t.budgets.finishAction}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
