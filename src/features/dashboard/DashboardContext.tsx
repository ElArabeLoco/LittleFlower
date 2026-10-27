/**
 * DashboardContext — shares a single useDashboardData() + useDashboardDebtSummary()
 * call across all chart components on the dashboard page.
 *
 * Without this, each of the 7+ chart components that call useMonthlyData() or
 * useDebtData() independently instantiates its own copy of useDashboardData(),
 * which creates 6 PowerSync reactive queries per component — 42+ redundant queries
 * total. During the initial PowerSync sync this fires all 42+ subscribers
 * simultaneously, overwhelming the JS thread and crashing the tab.
 *
 * With this provider the dashboard runs exactly:
 * 6 queries (useDashboardData)
 * 3 queries (useDashboardDebtSummary)
 * regardless of how many chart components are mounted.
 */

import { useMemo } from 'react';
import { useDashboardData } from '@/application/useDashboardData';
import { useDashboardDebtSummary } from '@/application/useDebtSummary';
import { DashboardContext, type DashboardContextValue } from './useDashboardCtx';

export function DashboardDataProvider({
  children,
  selectedMonth,
}: {
  children: React.ReactNode;
  selectedMonth: string;
}) {
  const data = useDashboardData(selectedMonth);
  const debtData = useDashboardDebtSummary();

  const value = useMemo<DashboardContextValue>(
    () => ({ ...data, ...debtData }),
    [data, debtData],
  );

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}
