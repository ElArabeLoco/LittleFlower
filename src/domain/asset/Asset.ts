/**
 * Asset — something the household owns, at its current value.
 *
 * No depreciation and no value history: the value is whatever the household
 * last wrote. Assets can have holders like incomes and debts (see holders.ts).
 */

/** Asset types. The order is the order they are offered in forms and lists. */
export const ASSET_KINDS = ['savings', 'investment', 'real_estate', 'vehicle', 'other'] as const;

export type AssetKind = (typeof ASSET_KINDS)[number];

/** Currencies an asset value can be written in. */
export const ASSET_CURRENCIES = ['COP', 'USD'] as const;

export type AssetCurrency = (typeof ASSET_CURRENCIES)[number];

export interface Asset {
  id: string;
  householdId: string;
  name: string;
  kind: AssetKind;
  /** Integer in `currency`. */
  value: number;
  currency: AssetCurrency;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastEditedBy: string | null;
  lastEditedAt: string | null;
  /** Soft delete: set means the asset no longer shows anywhere. */
  deletedAt: string | null;
}

/** Kind for a value read from sync; anything unknown falls back to other. */
export function toAssetKind(value: unknown): AssetKind {
  return ASSET_KINDS.find(kind => kind === value) ?? 'other';
}

/** Currency for a value read from sync; anything unknown falls back to COP. */
export function toAssetCurrency(value: unknown): AssetCurrency {
  return ASSET_CURRENCIES.find(currency => currency === value) ?? 'COP';
}
