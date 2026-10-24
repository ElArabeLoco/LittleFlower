import { useCallback } from 'react';
import {
  insertAsset as insertAssetMW,
  updateAsset as updateAssetMW,
  softDeleteAsset as softDeleteAssetMW,
  type InsertAssetPayload,
} from '@/infrastructure/powersync/mutationWrappers';

/** What the asset form writes. */
export type AssetFields = Pick<InsertAssetPayload, 'name' | 'kind' | 'value' | 'currency'>;

export function useAssetMutations(householdId: string, userId: string) {
  const createAsset = useCallback(
    async (fields: AssetFields, holderIds: string[]) => {
      return insertAssetMW({ ...fields, household_id: householdId, created_by: userId }, userId, holderIds);
    },
    [householdId, userId],
  );

  const updateAsset = useCallback(
    async (id: string, fields: AssetFields, holderIds: string[]) => {
      return updateAssetMW(id, fields, userId, holderIds);
    },
    [userId],
  );

  const deleteAsset = useCallback(
    async (id: string) => {
      return softDeleteAssetMW(id, userId);
    },
    [userId],
  );

  return { createAsset, updateAsset, deleteAsset };
}
