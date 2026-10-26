import { Pencil, Trash2, CalendarOff, History } from 'lucide-react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { Button } from '@/shared/ui/button';
import { getCategoryEmoji, getCategoryName } from '@/domain/budget/categories';
import type { PaymentMode } from '@/domain/budget/Budget';
import { BudgetFormDialog } from './BudgetFormDialog';
import { BudgetHistoryDialog } from './BudgetHistoryDialog';
import { FinishBudgetDialog } from './FinishBudgetDialog';
import type { BudgetRow, DebtOption, ExpenseSpan } from './types';

interface BudgetListProps {
  items: BudgetRow[];
  emptyLabel: string;
  householdId: string;
  userId: string;
  debts: DebtOption[];
  onDelete: (id: string, name: string) => void;
  expenseSpans: Map<string, ExpenseSpan>;
  /** Rows of the finished list: no "Finalizar", and the name line shows the payment mode. */
  finished?: boolean;
}

export function BudgetList({ items, emptyLabel, householdId, userId, debts, onDelete, expenseSpans, finished = false }: BudgetListProps) {
  const { t } = useI18n();
  const { formatCOP } = useNumberFormat();

  if (items.length === 0) {
    return <p className="text-sm text-gray-400 py-4 text-center">{emptyLabel}</p>;
  }

  const modeLabel = (mode: string) =>
    mode === 'cash' ? t.budgets.cashMethod : mode === 'both' ? t.budgets.bothMethod : t.budgets.cardMethod;

  return (
    <ul className="divide-y divide-[var(--border-subtle)]">
      {items.map(b => {
        const span = expenseSpans.get(b.id) ?? null;
        return (
          <li key={b.id} className="flex flex-col gap-1 py-3 px-1 hover:bg-[var(--bg-hover)] rounded-lg transition-colors sm:flex-row sm:items-center sm:gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                <span className="mr-1.5">{getCategoryEmoji(b.category_id)}</span>{b.name}
                {finished && <span className="font-normal text-[var(--text-muted)]"> · {modeLabel(b.payment_mode)}</span>}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {getCategoryName(b.category_id)} ·{' '}
                {b.end_month
                  ? `${b.start_month} → ${b.end_month}`
                  : `${t.common.from} ${b.start_month}`}{' '}
                · {formatCOP(b.default_amount)}/mes
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1 shrink-0">
              <BudgetHistoryDialog
                budget={b}
                trigger={
                  <Button variant="ghost" size="icon" className="text-[var(--text-secondary)]"
                    aria-label={t.budgets.historyAction} title={t.budgets.historyAction}>
                    <History size={16} />
                  </Button>
                }
              />
              <BudgetFormDialog
                mode="edit"
                budgetId={b.id}
                householdId={householdId}
                userId={userId}
                debts={debts}
                expenseSpan={span}
                initial={{
                  name: b.name,
                  description: b.description ?? '',
                  category_id: b.category_id,
                  start_month: b.start_month,
                  end_month: b.end_month ?? '',
                  default_amount: String(b.default_amount),
                  payment_mode: (b.payment_mode as PaymentMode) ?? 'credit_card',
                  debt_id: b.debt_id ?? '',
                }}
                onDone={() => {}}
                trigger={
                  <Button variant="ghost" size="icon" className="text-[var(--text-secondary)] hover:text-pink-600"
                    aria-label={t.budgets.editAction} title={t.budgets.editAction}>
                    <Pencil size={16} />
                  </Button>
                }
              />
              {!finished && (
                <FinishBudgetDialog
                  budget={b}
                  expenseSpan={span}
                  householdId={householdId}
                  userId={userId}
                  trigger={
                    <Button variant="ghost" size="icon" className="text-[var(--text-secondary)]"
                      aria-label={t.budgets.finishAction} title={t.budgets.finishAction}>
                      <CalendarOff size={16} />
                    </Button>
                  }
                />
              )}
              {!span && (
                <Button variant="ghost" size="icon" className="text-rose-600 hover:text-rose-700"
                  aria-label={t.budgets.deleteAction} title={t.budgets.deleteAction}
                  onClick={() => onDelete(b.id, b.name)}>
                  <Trash2 size={16} />
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
