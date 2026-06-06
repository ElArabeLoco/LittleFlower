/**
 * PowerSyncExchangeRateRepository — implements IExchangeRateRepository using PowerSync.
 */

import { db } from '../client';
import { newId, now, authorshipStamp, assertAuth } from '../mutationHelpers';
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

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

export interface UpsertExchangeRatePayload {
  id?: string;
  household_id: string;
  from_currency: string;
  to_currency: string;
  month: string;            // 'YYYY-MM'
  rate: number;
  source: 'manual' | 'fallback';
}

export async function upsertExchangeRate(
  payload: UpsertExchangeRatePayload,
  userId: string,
): Promise<string> {
  assertAuth(payload.household_id, userId);
  // PowerSync exposes tables as views — ON CONFLICT is not supported on views,
  // and result.rowsAffected is unreliable on views. Use explicit SELECT EXISTS
  // to decide between UPDATE and INSERT.
  const stamp = authorshipStamp(userId);
  const ts = now();

  const exists =
    !!payload.id &&
    !!(await db.get<{ id: string }>(
      `SELECT id FROM exchange_rates WHERE id = ?`,
      [payload.id],
    ));

  if (exists) {
    await db.execute(
      `UPDATE exchange_rates
       SET rate = ?, source = ?,
           updated_at = ?, last_edited_by = ?, last_edited_at = ?
       WHERE id = ?`,
      [
        payload.rate,
        payload.source,
        ts,
        stamp.last_edited_by,
        stamp.last_edited_at,
        payload.id!,
      ],
    );
    return payload.id!;
  }

  const id = payload.id ?? newId();
  await db.execute(
    `INSERT INTO exchange_rates
       (id, household_id, from_currency, to_currency, month, rate, source,
        updated_at, last_edited_by, last_edited_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payload.household_id,
      payload.from_currency,
      payload.to_currency,
      payload.month,
      payload.rate,
      payload.source,
      ts,
      stamp.last_edited_by,
      stamp.last_edited_at,
    ],
  );
  return id;
}

export async function updateExchangeRate(
  id: string,
  rate: number,
  source: 'manual' | 'fallback',
  userId: string,
): Promise<void> {
  const stamp = authorshipStamp(userId);
  await db.execute(
    `UPDATE exchange_rates
     SET rate = ?, source = ?, updated_at = ?, last_edited_by = ?, last_edited_at = ?
     WHERE id = ?`,
    [rate, source, now(), stamp.last_edited_by, stamp.last_edited_at, id],
  );
}
