import { useQuery } from '@powersync/react';
import type { AssetRow, AssetValuationRow } from './types';

/** All active assets, alphabetical. */
export function useAssetsQuery() {
  return useQuery<AssetRow>(
    `SELECT id, name, kind, value, currency FROM assets
     WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE`,
  );
}

/** Value history of every active asset, oldest first. */
export function useAssetValuationsQuery() {
  return useQuery<AssetValuationRow>(
    `SELECT v.id, v.asset_id, v.value, v.currency, v.valued_on, v.note, v.created_at
     FROM asset_valuations v
     JOIN assets a ON a.id = v.asset_id AND a.deleted_at IS NULL
     WHERE v.deleted_at IS NULL
     ORDER BY v.asset_id, v.valued_on, v.created_at`,
  );
}
