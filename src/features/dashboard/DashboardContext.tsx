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
 *   6 queries (useDashboardData)
 *   3 queries (useDashboardDebtSummary)
 * regardless of how many chart components are mounted.
 */

import { createContext, useContext } from 'react';
import { useDashboardData, type DashboardData } from '@/application/useDashboardData';
import { useDashboardDebtSummary, type DashboardDebtSummary } from '@/application/useDebtSummary';

export interface DashboardContextValue extends DashboardData, DashboardDebtSummary {}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardDataProvider({ children }: { children: React.ReactNode }) {
  const data = useDashboardData();
  const debtData = useDashboardDebtSummary();

  return (
    <DashboardContext.Provider value={{ ...data, ...debtData }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardCtx(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboardCtx must be used inside DashboardDataProvider');
  return ctx;
}
