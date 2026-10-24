import { useMemo } from 'react';
import { useAssetsQuery } from '@/infrastructure/powersync/queries/useAssetQueries';
import { useLatestExchangeRate } from '@/infrastructure/powersync/queries/useExchangeRateQueries';
import { toAssetItems, type AssetItem } from './assetItems';
import { useHoldersBySubject } from './useHolders';

export type { AssetItem };

export interface AssetsData {
  /** Active assets, alphabetical. */
  assets: AssetItem[];
  /** Sum of every asset in COP (USD with the latest TRM). */
  totalCOP: number;
  /** Some USD asset has no TRM and is left out of `totalCOP`. */
  hasMissingTrm: boolean;
}

/** The household's active assets with holders and COP values. */
export function useAssets(): AssetsData {
  const { data: rows = [] } = useAssetsQuery();
  const { data: rateRows = [] } = useLatestExchangeRate();
  const holdersByAsset = useHoldersBySubject('asset');
  const trm = rateRows[0]?.rate ?? null;

  return useMemo(() => {
    const assets = toAssetItems(rows, trm, holdersByAsset);
    return {
      assets,
      totalCOP: assets.reduce((sum, asset) => sum + asset.valueCOP, 0),
      hasMissingTrm: assets.some(asset => asset.missingTrm),
    };
  }, [rows, trm, holdersByAsset]);
}
