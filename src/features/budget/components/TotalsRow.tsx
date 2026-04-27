import { useI18n } from '@/shared/i18n/I18nContext';
import { AbbreviatedAmount } from '@/shared/ui/AbbreviatedAmount';
import { cn } from '@/shared/ui/cn';

export interface MonthMetrics {
  available: number;
  budgeted: number;
  executed: number;
  pending: number;
}

interface TotalsRowProps {
  months: string[];
  metricsMap: Map<string, MonthMetrics>;
  nameColCollapsed: boolean;
}

export function TotalsRow({ months, metricsMap, nameColCollapsed }: TotalsRowProps) {
  const { t } = useI18n();
  const metrics = [
    { key: 'budgeted' as const, label: t.yearView.budgetedRow, color: 'text-[var(--text-secondary)]' },
    { key: 'executed' as const, label: t.yearView.executedRow, color: 'text-violet-700 dark:text-violet-400' },
    { key: 'pending'  as const, label: t.yearView.toExecuteRow, color: 'text-amber-600 dark:text-amber-400' },
  ];
  return (
    <>
      {metrics.map(m => (
        <tr key={m.key} className="bg-[var(--group-totals-bg)] border-t border-[var(--border-subtle)]">
          <td className={cn(
            'sticky left-0 z-10 bg-[var(--group-totals-sticky)] py-1 text-xs text-[var(--text-secondary)] font-medium whitespace-nowrap border-r border-[var(--border-subtle)] transition-all duration-200',
            nameColCollapsed ? 'px-1 w-9 text-center' : 'px-3',
          )}>
            {nameColCollapsed ? '' : m.label}
          </td>
          {months.map(month => {
            const v = metricsMap.get(month)?.[m.key] ?? 0;
            return (
              <td key={month} className={cn('border-r border-[var(--border-subtle)] px-2 py-1 text-right text-xs tabular-nums font-medium', m.color)}>
                <AbbreviatedAmount value={v} />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}