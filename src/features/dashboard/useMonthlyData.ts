/**
 * Thin adapter — composes useDashboardData with locale-aware labels.
 * Dashboard chart components import from here; SQL and calculations live upstream.
 */
import { useMemo } from 'react';
import { useDashboardData, type MonthlyDataPoint } from '@/application/useDashboardData';
import { useI18n } from '@/shared/i18n/I18nContext';
import { makeShortMonth } from './helpers';

export type { MonthlyDataPoint };

export function useMonthlyData() {
  const { t } = useI18n();
  const shortMonth = makeShortMonth(t);
  const data = useDashboardData();

  // Attach locale-aware display labels (depends on locale, so stays in the feature layer)
  const monthlyData: MonthlyDataPoint[] = useMemo(
    () => data.monthlyData.map(d => ({ ...d, label: shortMonth(d.month) })),
    [data.monthlyData, shortMonth],
  );

  return { ...data, monthlyData };
}
