import { useMemo } from 'react';
import { useAssetsQuery, useAssetValuationsQuery } from '@/infrastructure/powersync/queries/useAssetQueries';
import { useLatestExchangeRate } from '@/infrastructure/powersync/queries/useExchangeRateQueries';
import { toAssetItems, toValuationsByAsset, type AssetHistoryEntry, type AssetItem } from './assetItems';
import { useHoldersBySubject } from './useHolders';

export type { AssetHistoryEntry, AssetItem };

export interface AssetsData {
  /** Active assets, alphabetical. */
  assets: AssetItem[];
  /** Sum of every asset in COP (USD with the latest TRM). */
  totalCOP: number;
  /** Some USD asset has no TRM and is left out of `totalCOP`. */
  hasMissingTrm: boolean;
  /** Assets with more than one value, alphabetical. */
  changedAssets: AssetItem[];
  /** Sum of their changes in COP (changes without a TRM are left out). */
  totalChangeCOP: number;
}

/** The household's active assets with holders, COP values and value history. */
export function useAssets(): AssetsData {
  const { data: rows = [] } = useAssetsQuery();
  const { data: valuationRows = [] } = useAssetValuationsQuery();
  const { data: rateRows = [] } = useLatestExchangeRate();
  const holdersByAsset = useHoldersBySubject('asset');
  const trm = rateRows[0]?.rate ?? null;

  return useMemo(() => {
    const assets = toAssetItems(rows, trm, holdersByAsset, toValuationsByAsset(valuationRows));
    const changedAssets = assets.filter(asset => asset.change !== null);
    return {
      assets,
      totalCOP: assets.reduce((sum, asset) => sum + asset.valueCOP, 0),
      hasMissingTrm: assets.some(asset => asset.missingTrm),
      changedAssets,
      totalChangeCOP: changedAssets.reduce((sum, asset) => sum + (asset.changeCOP ?? 0), 0),
    };
  }, [rows, valuationRows, trm, holdersByAsset]);
}
