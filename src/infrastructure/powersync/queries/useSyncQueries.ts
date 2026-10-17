import { useQuery } from '@powersync/react';

interface PendingUploadCountRow {
  count: number;
}

/** Number of local changes waiting in PowerSync's upload queue (ps_crud). */
export function usePendingUploadCount(): number {
  const { data } = useQuery<PendingUploadCountRow>('SELECT COUNT(*) AS count FROM ps_crud');
  return data[0]?.count ?? 0;
}
