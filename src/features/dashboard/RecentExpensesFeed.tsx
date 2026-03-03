import { useQuery } from '@powersync/react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { CATEGORY_MAP } from '@/domain/budget/categories';
import { AbbreviatedAmount } from '@/shared/ui/AbbreviatedAmount';
import { ChartCard } from './shared';
import { fmtDate } from './helpers';
import type { RecentExpenseRow } from './types';

export function RecentExpensesFeed() {
  const { t } = useI18n();

  const { data: recentExpenses = [] } = useQuery<RecentExpenseRow>(
    `SELECT e.id, e.amount, e.note, e.timestamp, b.name as budget_name, b.category_id
     FROM expenses e
     JOIN budgets b ON b.id = e.budget_id
     WHERE e.deleted_at IS NULL AND e.amount > 0
     ORDER BY e.timestamp DESC, e.created_at DESC
     LIMIT 10`,
  );

  if (recentExpenses.length === 0) return null;

  return (
    <ChartCard title={t.dashboard.recentExpenses} subtitle={t.dashboard.recentExpensesDesc}>
      <div className="space-y-1 -mx-1">
        {recentExpenses.map(exp => {
          const cat = CATEGORY_MAP.get(exp.category_id);
          return (
            <div
              key={exp.id}
              className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-[var(--bg-hover)] transition-colors"
            >
              <span className="w-8 h-8 rounded-xl bg-[var(--bg-surface-2)] flex items-center justify-center text-base shrink-0 border border-[var(--border-subtle)]">
                {cat?.emoji ?? '💸'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                  {exp.budget_name}
                  {exp.note ? <span className="text-[var(--text-muted)] font-normal"> · {exp.note}</span> : null}
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">{fmtDate(exp.timestamp)}</p>
              </div>
              <AbbreviatedAmount value={exp.amount} className="text-xs font-semibold text-[var(--text-primary)] tabular-nums shrink-0" />
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
}
