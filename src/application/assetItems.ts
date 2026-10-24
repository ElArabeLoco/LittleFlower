import { toAssetCurrency, toAssetKind, type AssetCurrency, type AssetKind } from '@/domain/asset/Asset';
import type { MemberRef } from '@/domain/member/HouseholdMember';
import { toCOPWithMissing } from '@/shared/helpers';
import type { AssetRow } from '@/infrastructure/powersync/queries/types';

/** One active asset, ready to show and to add up. */
export interface AssetItem {
  id: string;
  name: string;
  kind: AssetKind;
  /** Integer in `currency`, as written. */
  value: number;
  currency: AssetCurrency;
  /** Value in COP with the latest TRM; 0 when a USD value has no TRM. */
  valueCOP: number;
  /** A USD value that could not be converted (left out of totals). */
  missingTrm: boolean;
  /** Active holders (empty = the whole household). */
  holders: MemberRef[];
}

/** Maps asset rows to items: safe kind / currency and the COP value with `trm`. */
export function toAssetItems(
  rows: AssetRow[],
  trm: number | null,
  holdersByAsset: Map<string, MemberRef[]>,
): AssetItem[] {
  return rows.map(row => {
    const currency = toAssetCurrency(row.currency);
    const { value: valueCOP, missingTrm } = toCOPWithMissing(row.value, currency, trm);
    return {
      id: row.id,
      name: row.name,
      kind: toAssetKind(row.kind),
      value: row.value,
      currency,
      valueCOP,
      missingTrm,
      holders: holdersByAsset.get(row.id) ?? [],
    };
  });
}
