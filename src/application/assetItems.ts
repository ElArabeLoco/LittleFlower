import { toAssetCurrency, toAssetKind, type AssetCurrency, type AssetKind } from '@/domain/asset/Asset';
import {
  sortValuations,
  valueChange,
  valueIn,
  type AssetValuation,
  type ValueChange,
} from '@/domain/asset/assetValuation';
import type { MemberRef } from '@/domain/member/HouseholdMember';
import { toCOPWithMissing } from '@/shared/helpers';
import type { AssetRow, AssetValuationRow } from '@/infrastructure/powersync/queries/types';

/** One value in an asset's history. */
export interface AssetHistoryEntry extends AssetValuation {
  /** The value in the asset's current currency (the other one with the latest TRM); null without a TRM. */
  inCurrent: number | null;
  /** Change against the previous value, in the current currency; null for the first one or without a TRM. */
  fromPrevious: number | null;
}

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
  /** Every value the asset has had, oldest first (empty until it syncs). */
  history: AssetHistoryEntry[];
  /** First value against the current one; null with fewer than two values. */
  change: ValueChange | null;
  /** `change.delta` in COP with the latest TRM; null without a change or a TRM. */
  changeCOP: number | null;
}

/** Valuation rows grouped by asset id, mapped to the domain type. */
export function toValuationsByAsset(rows: AssetValuationRow[]): Map<string, AssetValuation[]> {
  const byAsset = new Map<string, AssetValuation[]>();
  for (const row of rows) {
    const list = byAsset.get(row.asset_id) ?? [];
    list.push({
      id: row.id,
      assetId: row.asset_id,
      value: row.value,
      currency: toAssetCurrency(row.currency),
      valuedOn: row.valued_on,
      note: row.note,
      createdAt: row.created_at,
    });
    byAsset.set(row.asset_id, list);
  }
  return byAsset;
}

/** Maps asset rows to items: safe kind / currency, the COP value with `trm` and the value history. */
export function toAssetItems(
  rows: AssetRow[],
  trm: number | null,
  holdersByAsset: Map<string, MemberRef[]>,
  valuationsByAsset: Map<string, AssetValuation[]> = new Map(),
): AssetItem[] {
  return rows.map(row => {
    const currency = toAssetCurrency(row.currency);
    const { value: valueCOP, missingTrm } = toCOPWithMissing(row.value, currency, trm);
    const sorted = sortValuations(valuationsByAsset.get(row.id) ?? []);
    const change = valueChange(sorted, trm);
    return {
      id: row.id,
      name: row.name,
      kind: toAssetKind(row.kind),
      value: row.value,
      currency,
      valueCOP,
      missingTrm,
      holders: holdersByAsset.get(row.id) ?? [],
      history: toHistory(sorted, currency, trm),
      change,
      changeCOP: change ? valueIn({ value: change.delta, currency: change.to.currency }, 'COP', trm) : null,
    };
  });
}

function toHistory(sorted: AssetValuation[], currency: AssetCurrency, trm: number | null): AssetHistoryEntry[] {
  let previous: number | null = null;
  return sorted.map((valuation, i) => {
    const inCurrent = valueIn(valuation, currency, trm);
    const fromPrevious = i > 0 && inCurrent !== null && previous !== null ? inCurrent - previous : null;
    previous = inCurrent;
    return { ...valuation, inCurrent, fromPrevious };
  });
}
