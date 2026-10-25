import { useCallback, useMemo } from 'react';
import { parseLayout, serializeLayout, type DashboardLayout } from '@/domain/dashboard/dashboardLayout';
import { saveDashboardLayout } from '@/infrastructure/powersync/mutationWrappers';
import { useDashboardLayoutQuery } from '@/infrastructure/powersync/queries/useDashboardLayoutQueries';

export interface DashboardLayoutData {
  /** The user's layout; the default one while nothing is saved. */
  layout: DashboardLayout;
  /** True until the saved row has been read, so a custom layout never flashes the default first. */
  isLoading: boolean;
  /** Saves the whole layout as the user's. Does nothing until the session has a household. */
  save: (layout: DashboardLayout) => Promise<void>;
}

/** The current user's dashboard layout: which widgets, in what order, how wide. */
export function useDashboardLayout(householdId: string, userId: string): DashboardLayoutData {
  const { data: rows = [], isLoading } = useDashboardLayoutQuery(userId);
  const raw = rows[0]?.layout ?? null;
  const layout = useMemo(() => parseLayout(raw), [raw]);

  const save = useCallback(
    async (next: DashboardLayout) => {
      if (!householdId || !userId) return;
      await saveDashboardLayout({ household_id: householdId, layout: serializeLayout(next) }, userId);
    },
    [householdId, userId],
  );

  return { layout, isLoading, save };
}
