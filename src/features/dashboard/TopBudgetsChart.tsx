import { useMemo } from 'react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { CATEGORY_MAP } from '@/domain/budget/categories';
import { AbbreviatedAmount } from '@/shared/ui/AbbreviatedAmount';
import { cn } from '@/shared/ui/cn';
import { ChartCard } from './shared';
import { useBudgetBaseData } from './useBudgetBaseData';

export function TopBudgetsChart() {
  const { t } = useI18n();
  const { budgets, bmIdMap, budgetAmountMap, expenseByBmId, currentMonth } = useBudgetBaseData();

  const topBudgets = useMemo(() => {
    return budgets
      .filter(b => {
        if (b.start_month > currentMonth) return false;
        if (b.end_month && b.end_month < currentMonth) return false;
        return true;
      })
      .map(b => {
        const bmRow = bmIdMap.get(`${b.id}|${currentMonth}`);
        const budgeted = budgetAmountMap.get(`${b.id}|${currentMonth}`) ?? b.default_amount;
        const spent = bmRow ? (expenseByBmId.get(bmRow.id) ?? 0) : 0;
        const cat = CATEGORY_MAP.get(b.category_id);
        return {
          name: b.name,
          budgeted,
          spent,
          pct: budgeted > 0 ? Math.min((spent / budgeted) * 100, 100) : 0,
          color: cat?.color ?? '#cbd5e1',
          emoji: cat?.emoji ?? '•',
        };
      })
      .filter(b => b.budgeted > 0)
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 6);
  }, [budgets, bmIdMap, budgetAmountMap, expenseByBmId, currentMonth]);

  if (topBudgets.length === 0) return null;

  return (
    <ChartCard
      title={t.dashboard.topBudgets}
      subtitle={t.dashboard.executionLabel}
    >
      <div className="space-y-3">
        {topBudgets.map((b, i) => {
          const over = b.spent > b.budgeted;
          return (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)] truncate">
                  <span>{b.emoji}</span>
                  <span className="truncate">{b.name}</span>
                </span>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <AbbreviatedAmount value={b.spent} className={cn('text-[11px] font-semibold tabular-nums',
                    over ? 'text-red-500 dark:text-red-400' : 'text-[var(--text-secondary)]')} />
                  <span className="text-[10px] text-[var(--text-muted)]">/ <AbbreviatedAmount value={b.budgeted} /></span>
                </div>
              </div>
              <div className="h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${b.pct}%`,
                    background: over ? '#f87171' : b.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
}
