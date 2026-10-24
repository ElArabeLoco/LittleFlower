import { useQuery } from '@powersync/react';
import type { AssetRow } from './types';

/** All active assets, alphabetical. */
export function useAssetsQuery() {
  return useQuery<AssetRow>(
    `SELECT id, name, kind, value, currency FROM assets
     WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE`,
  );
}
