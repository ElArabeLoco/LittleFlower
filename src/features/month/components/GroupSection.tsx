import { useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { AbbreviatedAmount } from '@/shared/ui/AbbreviatedAmount';
import { cn } from '@/shared/ui/cn';
import type { BudgetRow, BudgetMonthRow } from '@/application/useMonthViewData';
import { BudgetCard } from './BudgetCard';
import { MiniProgressBar } from './MiniProgressBar';

interface BudgetCardListProps {
  budgets: BudgetRow[];
  bmMap: Map<string, BudgetMonthRow>;
  expenseMap: Map<string, number>;
  month: string;
  householdId: string;
  userId: string;
  sortKey: 'pending-desc' | 'value-desc' | 'value-asc' | 'name-asc' | 'name-desc' | 'category-asc' | 'category-desc';
  filterText: string;
  pendingLabel: string;
  executedLabel: string;
  onToggleExecution: (bm: BudgetMonthRow | null, budget: BudgetRow, month: string, amount: number, isExecuted: boolean) => Promise<void>;
}

export function BudgetCardList({
  budgets, bmMap, expenseMap, month, householdId, userId,
  sortKey, filterText, pendingLabel, executedLabel, onToggleExecution,
}: BudgetCardListProps) {
  const showDividers = sortKey === 'pending-desc';

  const pendingBudgets = showDividers
    ? budgets.filter(b => (bmMap.get(`${b.id}|${month}`)?.is_executed ?? 0) !== 1)
    : budgets;
  const executedBudgets = showDividers
    ? budgets.filter(b => bmMap.get(`${b.id}|${month}`)?.is_executed === 1)
    : [];

  function renderCard(b: BudgetRow) {
    const bm = bmMap.get(`${b.id}|${month}`) ?? null;
    const spent = bm ? (expenseMap.get(bm.id) ?? 0) : 0;
    return (
      <BudgetCard
        key={b.id}
        budget={b}
        bm={bm}
        spentAmount={spent}
        month={month}
        householdId={householdId}
        userId={userId}
        highlightText={filterText}
        onToggleExecution={onToggleExecution}
      />
    );
  }

  return (
    <div className="space-y-2">
      {showDividers && pendingBudgets.length > 0 && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs font-medium text-[var(--text-muted)]">
            {pendingLabel}
          </span>
          <div className="flex-1 h-px bg-[var(--border-subtle)]" />
        </div>
      )}
      {pendingBudgets.map(renderCard)}
      {showDividers && executedBudgets.length > 0 && (
        <div className="flex items-center gap-2 px-1 pt-1">
          <span className="text-xs font-medium text-[var(--text-muted)]">
            {executedLabel}
          </span>
          <div className="flex-1 h-px bg-[var(--border-subtle)]" />
        </div>
      )}
      {showDividers && executedBudgets.map(renderCard)}
    </div>
  );
}

interface GroupSectionProps {
  label: string;
  icon: React.ReactNode;
  accent: 'violet' | 'green';
  budgets: BudgetRow[];
  bmMap: Map<string, BudgetMonthRow>;
  expenseMap: Map<string, number>;
  month: string;
  householdId: string;
  userId: string;
  totalBudgeted: number;
  totalSpent: number;
  sortKey: 'pending-desc' | 'value-desc' | 'value-asc' | 'name-asc' | 'name-desc' | 'category-asc' | 'category-desc';
  filterText: string;
  onToggleExecution: (bm: BudgetMonthRow | null, budget: BudgetRow, month: string, amount: number, isExecuted: boolean) => Promise<void>;
}

export function GroupSection({
  label, icon, accent, budgets, bmMap, expenseMap,
  month, householdId, userId, totalBudgeted, totalSpent,
  sortKey, filterText, onToggleExecution,
}: GroupSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useI18n();

  if (budgets.length === 0) return null;

  const over = totalSpent > totalBudgeted;
  const pct = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;
  const remaining = totalBudgeted - totalSpent;

  return (
    <section>
      <button
        className={cn(
          'w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl border mb-2 transition-colors text-left',
          accent === 'violet'
            ? 'bg-[var(--group-cc-bg)] border-[var(--group-cc-border)]'
            : 'bg-[var(--group-cash-bg)] border-[var(--group-cash-border)]',
        )}
        onClick={() => setCollapsed(c => !c)}
      >
        <span className={cn(
          'shrink-0',
          accent === 'violet' ? 'text-[var(--group-cc-text)]' : 'text-[var(--group-cash-text)]',
        )}>
          {icon}
        </span>
        <span className={cn(
          'flex-1 text-sm font-semibold',
          accent === 'violet' ? 'text-[var(--group-cc-text)]' : 'text-[var(--group-cash-text)]',
        )}>
          {label}
        </span>
        <span className={cn(
          'text-xs font-semibold tabular-nums shrink-0',
          over ? 'text-[var(--text-negative)]' : accent === 'violet' ? 'text-[var(--group-cc-text)]' : 'text-[var(--group-cash-text)]',
        )}>
          {totalSpent > 0 ? `${pct}%` : <AbbreviatedAmount value={totalBudgeted} />}
        </span>
        <span className={cn(
          'shrink-0 transition-transform duration-200',
          accent === 'violet' ? 'text-[var(--group-cc-text)]' : 'text-[var(--group-cash-text)]',
          collapsed && 'rotate-180',
        )}>
          <ChevronUp size={14} />
        </span>
      </button>

      {!collapsed && totalSpent > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 mb-2 bg-[var(--group-totals-bg)] rounded-lg border border-[var(--border-subtle)]">
          <div className="flex-1 min-w-0">
            <MiniProgressBar pct={pct} over={over} />
          </div>
          <span className={cn(
            'text-xs font-medium tabular-nums shrink-0',
            over ? 'text-[var(--text-negative)]' : 'text-[var(--text-secondary)]',
          )}>
            <AbbreviatedAmount value={totalSpent} /> / <AbbreviatedAmount value={totalBudgeted} />
          </span>
          <span className={cn(
            'text-xs font-semibold tabular-nums shrink-0',
            remaining < 0 ? 'text-[var(--text-negative)]' : 'text-[var(--text-positive)]',
          )}>
            {remaining >= 0 ? '+' : ''}<AbbreviatedAmount value={remaining} />
          </span>
        </div>
      )}

      {!collapsed && (
        <BudgetCardList
          budgets={budgets}
          bmMap={bmMap}
          expenseMap={expenseMap}
          month={month}
          householdId={householdId}
          userId={userId}
          sortKey={sortKey}
          filterText={filterText}
          pendingLabel={t.monthView.pending}
          executedLabel={t.monthView.executed}
          onToggleExecution={onToggleExecution}
        />
      )}
    </section>
  );
}