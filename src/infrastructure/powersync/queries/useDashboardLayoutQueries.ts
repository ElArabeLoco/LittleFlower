import { useQuery } from '@powersync/react';
import type { DashboardLayoutRow } from './types';

/** The user's saved dashboard layout (zero or one row). Empty user id → no rows. */
export function useDashboardLayoutQuery(userId: string) {
  return useQuery<DashboardLayoutRow>(
    userId
      ? `SELECT id, layout FROM dashboard_layouts WHERE id = ? LIMIT 1`
      : `SELECT id, layout FROM dashboard_layouts WHERE 1=0`,
    userId ? [userId] : [],
  );
}
