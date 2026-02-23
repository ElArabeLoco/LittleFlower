import type { EntityId, ISODateTime, YearMonth } from '../shared/types';

export type ExchangeRateSource = 'manual' | 'fallback';

/**
 * ExchangeRate — the monthly TRM for a currency pair.
 *
 * MVP: one mutable record per (householdId, fromCurrency, toCurrency, month).
 * Phase 2: append-only log with supersededBy field.
 *
 * rate is a float (e.g. 4200.50) — TRM has decimal precision.
 * All expense/income amounts remain integers (COP).
 */
export interface ExchangeRate {
  id: EntityId;
  householdId: string;
  fromCurrency: string; // ISO 4217, e.g. 'USD'
  toCurrency: string; // always 'COP' for now
  month: YearMonth; // 'YYYY-MM'
  rate: number; // float — e.g. 4200.5
  source: ExchangeRateSource;
  updatedAt: ISODateTime;
  lastEditedBy: string | null;
  lastEditedAt: ISODateTime | null;
}
