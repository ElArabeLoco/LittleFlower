import { useMemo } from 'react';
import { CreditCard } from 'lucide-react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { CATEGORY_MAP } from '@/domain/budget/categories';
import { AbbreviatedAmount } from '@/shared/ui/AbbreviatedAmount';
import { ChartCard } from './shared';
import { makeShortMonth } from './helpers';
import { useBudgetBaseData } from './useBudgetBaseData';
import type { ExceededRow } from './types';

export function ExceededBudgetsChart() {
  const { t } = useI18n();
  const shortMonth = makeShortMonth(t);
  const { budgets, bmIdMap, expenseByBmId, budgetAmountMap, last6 } = useBudgetBaseData();

  const exceededBudgets = useMemo((): ExceededRow[] => {
    const rows: ExceededRow[] = [];
    for (const b of budgets) {
      for (const month of last6) {
        if (b.start_month > month) continue;
        if (b.end_month && b.end_month < month) continue;
        const bmKey = `${b.id}|${month}`;
        const bmRow = bmIdMap.get(bmKey);
        if (!bmRow) continue;
        const spent = expenseByBmId.get(bmRow.id) ?? 0;
        if (spent <= 0) continue;
        const budgeted = budgetAmountMap.get(bmKey) ?? b.default_amount;
        if (spent <= budgeted) continue;
        const cat = CATEGORY_MAP.get(b.category_id);
        rows.push({
          budgetId: b.id,
          name: b.name,
          emoji: cat?.emoji ?? '•',
          color: cat?.color ?? '#cbd5e1',
          isCreditCard: b.paid_with_credit_card === 1,
          month,
          label: shortMonth(month),
          budgeted,
          spent,
          overage: spent - budgeted,
          pct: budgeted > 0 ? Math.round((spent / budgeted) * 100) : 0,
        });
      }
    }
    return rows.sort((a, b) => b.overage - a.overage);
  }, [budgets, last6, bmIdMap, expenseByBmId, budgetAmountMap, shortMonth]);

  if (exceededBudgets.length === 0) return null;

  return (
    <ChartCard
      title={t.dashboard.exceededBudgets}
      subtitle={t.dashboard.exceededDesc(exceededBudgets.length)}
    >
      <div className="space-y-3">
        {exceededBudgets.map((b, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)] truncate min-w-0">
                <span className="shrink-0">{b.emoji}</span>
                <span className="truncate">{b.name}</span>
                <span className="shrink-0 text-[10px] text-[var(--text-muted)] font-normal">
                  {b.label}
                </span>
                {b.isCreditCard && (
                  <CreditCard size={10} className="shrink-0 text-violet-400" />
                )}
              </span>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="text-[11px] font-bold tabular-nums text-red-500 dark:text-red-400">
                  +<AbbreviatedAmount value={b.overage} />
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  {b.pct}%
                </span>
              </div>
            </div>
            <div className="h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all bg-red-400"
                style={{ width: `${Math.min(b.pct, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[10px] text-[var(--text-muted)]">{t.dashboard.budgetedShort} <AbbreviatedAmount value={b.budgeted} /></span>
              <span className="text-[10px] text-red-500 dark:text-red-400">{t.dashboard.spentShort} <AbbreviatedAmount value={b.spent} /></span>
            </div>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}
