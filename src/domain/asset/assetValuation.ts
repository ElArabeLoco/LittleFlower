/**
 * AssetValuation — one value an asset had, written by hand on the day the
 * household learned it (a property appreciated, a vehicle depreciated).
 *
 * No automatic depreciation: the history is only what people wrote. The
 * asset's current value is its latest valuation.
 */

import type { AssetCurrency } from './Asset';

export interface AssetValuation {
  id: string;
  assetId: string;
  /** Integer in `currency`. */
  value: number;
  currency: AssetCurrency;
  /** YYYY-MM-DD: the day this value was known. */
  valuedOn: string;
  note: string | null;
  createdAt: string;
}

export interface ValueChange {
  /** The oldest valuation. */
  from: AssetValuation;
  /** The latest valuation (the current value). */
  to: AssetValuation;
  /** `to.value` minus `from.value`, in `to.currency`. Negative = depreciated. */
  delta: number;
  /** Change over the first value, one decimal; null when the first value is 0. */
  percent: number | null;
}

/**
 * Id of an asset's first valuation. Deterministic, so the migration
 * backfill and two devices writing it offline never create two of them.
 */
export function initialValuationId(assetId: string): string {
  return `initial:${assetId}`;
}

/** Oldest first: by `valuedOn`, then by `createdAt`. Returns a new array. */
export function sortValuations(valuations: AssetValuation[]): AssetValuation[] {
  return [...valuations].sort(
    (a, b) => a.valuedOn.localeCompare(b.valuedOn) || a.createdAt.localeCompare(b.createdAt),
  );
}

/** The current value: the most recent valuation by date. */
export function latestValuation(valuations: AssetValuation[]): AssetValuation | null {
  return sortValuations(valuations).at(-1) ?? null;
}

/**
 * Change between the first and the latest valuation, in the latest
 * currency. A first value in the other currency converts with `trm`
 * (COP per USD); without it there is no change to report.
 */
export function valueChange(valuations: AssetValuation[], trm: number | null): ValueChange | null {
  if (valuations.length < 2) return null;
  const sorted = sortValuations(valuations);
  const from = sorted[0];
  const to = sorted[sorted.length - 1];

  const fromValue = convert(from.value, from.currency, to.currency, trm);
  if (fromValue === null) return null;

  const delta = to.value - fromValue;
  const percent = fromValue === 0 ? null : Math.round((delta / fromValue) * 1000) / 10;
  return { from, to, delta, percent };
}

function convert(value: number, from: AssetCurrency, to: AssetCurrency, trm: number | null): number | null {
  if (from === to) return value;
  if (!trm) return null;
  return from === 'USD' ? Math.round(value * trm) : Math.round(value / trm);
}
