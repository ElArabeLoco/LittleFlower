/**
 * Thin adapter — reads from DashboardContext and attaches locale-aware labels.
 * Dashboard chart components import from here; SQL and calculations live upstream.
 *
 * Reads from the shared DashboardContext (not useDashboardData directly) so the
 * underlying PowerSync queries run exactly once per dashboard mount regardless of
 * how many chart components are on the page.
 */
import { useMemo } from 'react';
import { useDashboardCtx } from './useDashboardCtx';
import type { MonthlyDataPoint } from '@/application/useDashboardData';
import { useI18n } from '@/shared/i18n/useI18n';
import { makeShortMonth } from './helpers';

export type { MonthlyDataPoint };

export function useMonthlyData() {
  const { t } = useI18n();
  // Stable reference — only changes when locale changes, not on every render.
  const shortMonth = useMemo(() => makeShortMonth(t), [t]);
  const data = useDashboardCtx();

  // Attach locale-aware display labels (depends on locale, so stays in the feature layer)
  const monthlyData: MonthlyDataPoint[] = useMemo(
    () => data.monthlyData.map(d => ({ ...d, label: shortMonth(d.month) })),
    [data.monthlyData, shortMonth],
  );

  return { ...data, monthlyData };
}
