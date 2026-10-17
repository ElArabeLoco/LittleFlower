import { ChartColumn } from 'lucide-react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { useHasBudgets } from '@/infrastructure/powersync/queries/useBudgetQueries';

export function EmptyState() {
  const { t } = useI18n();
  const { data: budgets = [] } = useHasBudgets();

  if (budgets.length > 0) return null;

  return (
    <div className="flex flex-col items-center py-20 text-center text-[var(--text-muted)]">
      <ChartColumn size={32} strokeWidth={1.5} aria-hidden="true" className="mb-4" />
      <p className="text-sm font-medium text-[var(--text-secondary)]">{t.dashboard.noDataYet}</p>
      <p className="text-xs mt-1">{t.dashboard.addBudgetsAndIncome}</p>
    </div>
  );
}
