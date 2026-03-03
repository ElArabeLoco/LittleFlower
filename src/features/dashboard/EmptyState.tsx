import { useQuery } from '@powersync/react';
import { useI18n } from '@/shared/i18n/I18nContext';

export function EmptyState() {
  const { t } = useI18n();
  const { data: budgets = [] } = useQuery<{ id: string }>(
    `SELECT id FROM budgets WHERE deleted_at IS NULL LIMIT 1`,
  );

  if (budgets.length > 0) return null;

  return (
    <div className="text-center py-20 text-[var(--text-muted)]">
      <p className="text-5xl mb-4">📊</p>
      <p className="text-sm font-medium text-[var(--text-secondary)]">{t.dashboard.noDataYet}</p>
      <p className="text-xs mt-1">{t.dashboard.addBudgetsAndIncome}</p>
    </div>
  );
}
