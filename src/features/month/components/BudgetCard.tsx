import { useState, useRef } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { useI18n } from '@/shared/i18n/useI18n';
import { getCategoryEmoji, getCategoryName } from '@/domain/budget/categories';
import type { PaymentMode } from '@/domain/budget/Budget';
import { ExpenseFormDialog } from '@/features/expenses/ExpenseFormDialog';
import { AbbreviatedAmount } from '@/shared/ui/AbbreviatedAmount';
import { cn } from '@/shared/ui/cn';
import type { BudgetRow, BudgetMonthRow } from '@/application/useMonthViewData';
import { MiniProgressBar } from './MiniProgressBar';

interface BudgetCardProps {
  budget: BudgetRow;
  bm: BudgetMonthRow | null;
  spentAmount: number;
  month: string;
  householdId: string;
  userId: string;
  highlightText?: string;
  onToggleExecution: (bm: BudgetMonthRow | null, budget: BudgetRow, month: string, amount: number, isExecuted: boolean) => Promise<void>;
}

function HighlightedName({ name, query }: { name: string; query: string }) {
  if (!query) return <>{name}</>;
  const idx = name.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return <>{name}</>;
  return (
    <>
      {name.slice(0, idx)}
      <mark className="bg-amber-200 dark:bg-amber-800/40 text-inherit rounded-sm px-0">
        {name.slice(idx, idx + query.length)}
      </mark>
      {name.slice(idx + query.length)}
    </>
  );
}


export function BudgetCard({ budget, bm, spentAmount, month, householdId, userId, highlightText = '', onToggleExecution }: BudgetCardProps) {
  const { t } = useI18n();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const expenseOpenKeyRef = useRef(0);

  const amount = bm?.amount ?? budget.default_amount;
  const isExecuted = bm?.is_executed === 1;
  const overBudget = spentAmount > amount;
  const remaining = amount - spentAmount;
  const pct = amount > 0 ? Math.round((spentAmount / amount) * 100) : 0;
  const hasExpenses = spentAmount > 0;

  async function toggleExecution() {
    await onToggleExecution(bm, budget, month, amount, isExecuted);
  }

  return (
    <>
      <div className={cn(
        'rounded-xl border transition-colors',
        isExecuted
          ? 'bg-green-50/40 border-green-100 dark:bg-green-950/20 dark:border-green-900/40'
          : 'bg-[var(--bg-surface)] border-[var(--border-subtle)]',
      )}>
        <div className="flex items-center gap-3 px-4 pt-3.5 pb-2.5">
          <span className="text-xl leading-none shrink-0">
            {getCategoryEmoji(budget.category_id)}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)] leading-tight flex items-center gap-1.5">
              <span className="truncate"><HighlightedName name={budget.name} query={highlightText} /></span>
              {budget.payment_mode === 'both' && (
                <span className="shrink-0 rounded-full px-1.5 py-px text-[11px] font-semibold leading-tight bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                  dual
                </span>
              )}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {getCategoryName(budget.category_id)}
            </p>
          </div>
          <button
            onClick={toggleExecution}
            title={isExecuted ? t.monthView.unmarkExecuted : t.monthView.markExecuted}
            className={cn(
              'shrink-0 transition-colors rounded-full p-0.5',
              isExecuted
                ? 'text-[var(--text-positive)] hover:text-green-600 dark:hover:text-green-300'
                : 'text-[var(--text-muted)] hover:text-[var(--text-positive)]',
            )}
          >
            {isExecuted ? <CheckCircle2 size={20} /> : <Circle size={20} />}
          </button>
        </div>

        <button
          className="w-full grid grid-cols-3 gap-1 px-4 pb-3 text-left hover:bg-[var(--bg-hover)] transition-colors rounded-b-xl"
          onClick={() => { expenseOpenKeyRef.current += 1; setExpenseOpen(true); }}
          title={t.monthView.viewOrAddExpenses}
        >
          <div>
            <p className="text-xs text-[var(--text-muted)] mb-0.5">{t.monthView.budgetLabel}</p>
            <p className="text-sm font-medium text-[var(--text-secondary)] tabular-nums">
              <AbbreviatedAmount value={amount} />
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)] mb-0.5">{t.monthView.spentLabel}</p>
            <p className={cn(
              'text-sm font-semibold tabular-nums',
              hasExpenses
                ? overBudget
                  ? 'text-[var(--text-negative)]'
                  : 'text-[var(--text-primary)]'
                : 'text-[var(--text-muted)]',
            )}>
              {hasExpenses ? <AbbreviatedAmount value={spentAmount} /> : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)] mb-0.5">{t.monthView.remainingLabel}</p>
            <p className={cn(
              'text-sm font-semibold tabular-nums',
              !hasExpenses
                ? 'text-[var(--text-muted)]'
                : remaining < 0
                  ? 'text-[var(--text-negative)]'
                  : 'text-[var(--text-positive)]',
            )}>
              {hasExpenses ? <AbbreviatedAmount value={remaining} /> : '—'}
            </p>
          </div>
        </button>

        {hasExpenses && (
          <div className="px-4 pb-3 -mt-1">
            <MiniProgressBar pct={pct} over={overBudget} />
          </div>
        )}
      </div>

      {expenseOpen && (
        <ExpenseFormDialog
          key={`${budget.id}|${month}|${expenseOpenKeyRef.current}`}
          budgetId={budget.id}
          budgetName={budget.name}
          budgetMonthId={bm?.id ?? null}
          budgetMonthAmount={amount}
          month={month}
          householdId={householdId}
          userId={userId}
          debtId={budget.debt_id}
          budgetPaymentMode={budget.payment_mode as PaymentMode}
          trigger={<span />}
          defaultOpen
          onClose={() => setExpenseOpen(false)}
        />
      )}
    </>
  );
}