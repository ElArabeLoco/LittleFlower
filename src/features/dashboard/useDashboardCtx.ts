import { createContext, useContext } from 'react';
import type { DashboardData } from '@/application/useDashboardData';
import type { DashboardDebtSummary } from '@/application/useDebtSummary';

export interface DashboardContextValue extends DashboardData, DashboardDebtSummary {}

export const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboardCtx(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboardCtx must be used inside DashboardDataProvider');
  return ctx;
}
