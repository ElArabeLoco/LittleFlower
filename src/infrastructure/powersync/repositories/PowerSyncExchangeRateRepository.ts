/**
 * PowerSyncExchangeRateRepository — implements IExchangeRateRepository using PowerSync.
 */

import { db } from '../client';
import type { IExchangeRateRepository } from '@/domain/exchangeRate/IExchangeRateRepository';
import type { ExchangeRate } from '@/domain/exchangeRate/ExchangeRate';

// ---------------------------------------------------------------------------
// Raw row shape
// ---------------------------------------------------------------------------

interface ExchangeRateRow {
  id: string;
  household_id: string;
  from_currency: string;
  to_currency: string;
  month: string;
  rate: number;
  source: string;
  updated_at: string;
  last_edited_by: string | null;
  last_edited_at: string | null;
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function toExchangeRate(row: ExchangeRateRow): ExchangeRate {
  return {
    id: row.id,
    householdId: row.household_id,
    fromCurrency: row.from_currency,
    toCurrency: row.to_currency,
    month: row.month,
    rate: row.rate,
    source: row.source as ExchangeRate['source'],
    updatedAt: row.updated_at,
    lastEditedBy: row.last_edited_by,
    lastEditedAt: row.last_edited_at,
  };
}

// ---------------------------------------------------------------------------
// Repository implementation
// ---------------------------------------------------------------------------

export class PowerSyncExchangeRateRepository implements IExchangeRateRepository {
  /** All exchange rates, ordered by month descending (most recent first). */
  async listAll(): Promise<ExchangeRate[]> {
    const rows = await db.getAll<ExchangeRateRow>(
      `SELECT * FROM exchange_rates ORDER BY month DESC`,
    );
    return rows.map(toExchangeRate);
  }

  /**
   * Exact match: (fromCurrency, toCurrency, month).
   * Returns null if no record exists for that combination.
   */
  async getExact(fromCurrency: string, toCurrency: string, month: string): Promise<ExchangeRate | null> {
    const row = await db.get<ExchangeRateRow>(
      `SELECT * FROM exchange_rates
       WHERE from_currency = ? AND to_currency = ? AND month = ?
       LIMIT 1`,
      [fromCurrency, toCurrency, month],
    );
    return row ? toExchangeRate(row) : null;
  }
}
