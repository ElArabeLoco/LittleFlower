import { useCallback } from 'react';
import {
  insertAsset as insertAssetMW,
  updateAsset as updateAssetMW,
  softDeleteAsset as softDeleteAssetMW,
  addAssetValuation as addAssetValuationMW,
  deleteAssetValuation as deleteAssetValuationMW,
  type AssetValuationPayload,
  type InsertAssetPayload,
} from '@/infrastructure/powersync/mutationWrappers';

/** What the new asset form writes. */
export type AssetFields = Pick<InsertAssetPayload, 'name' | 'kind' | 'value' | 'currency'>;

/** What editing an asset changes: its value changes through addValuation. */
export type AssetDetails = Pick<AssetFields, 'name' | 'kind'>;

/** A new value of an asset. */
export interface AssetValueEntry {
  value: number;
  currency: AssetFields['currency'];
  /** YYYY-MM-DD */
  valuedOn: string;
  note: string;
}

export function useAssetMutations(householdId: string, userId: string) {
  const createAsset = useCallback(
    async (fields: AssetFields, holderIds: string[]) => {
      return insertAssetMW({ ...fields, household_id: householdId, created_by: userId }, userId, holderIds);
    },
    [householdId, userId],
  );

  const updateAsset = useCallback(
    async (id: string, details: AssetDetails, holderIds: string[]) => {
      return updateAssetMW(id, { name: details.name, kind: details.kind }, userId, holderIds);
    },
    [userId],
  );

  const deleteAsset = useCallback(
    async (id: string) => {
      return softDeleteAssetMW(id, userId);
    },
    [userId],
  );

  const addValuation = useCallback(
    async (assetId: string, entry: AssetValueEntry) => {
      const payload: AssetValuationPayload = {
        value: entry.value,
        currency: entry.currency,
        valued_on: entry.valuedOn,
        note: entry.note,
      };
      return addAssetValuationMW(assetId, payload, userId);
    },
    [userId],
  );

  const deleteValuation = useCallback(
    async (valuationId: string) => {
      return deleteAssetValuationMW(valuationId, userId);
    },
    [userId],
  );

  return { createAsset, updateAsset, deleteAsset, addValuation, deleteValuation };
}
