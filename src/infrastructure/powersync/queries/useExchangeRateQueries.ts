import { useQuery } from '@powersync/react';
import type { ExchangeRateRow } from './types';

/** USD→COP exchange rate for a specific month. */
export function useExchangeRateForMonth(month: string) {
  return useQuery<ExchangeRateRow>(
    `SELECT id, rate, source FROM exchange_rates
     WHERE from_currency = 'USD' AND to_currency = 'COP' AND month = ?
     LIMIT 1`,
    [month],
  );
}

/** USD→COP exchange rates for multiple months (dashboard charts). */
export function useExchangeRatesForMonths(months: string[]) {
  return useQuery<ExchangeRateRow>(
    months.length > 0
      ? `SELECT month, rate FROM exchange_rates
         WHERE from_currency = 'USD' AND to_currency = 'COP'
         AND month IN (${months.map(() => '?').join(',')})`
      : `SELECT month, rate FROM exchange_rates WHERE 1=0`,
    months,
  );
}

/** USD→COP exchange rates for a calendar year range (YearView). */
export function useExchangeRatesForRange(fromMonth: string, toMonth: string) {
  return useQuery<ExchangeRateRow>(
    `SELECT month, rate FROM exchange_rates
     WHERE from_currency = 'USD' AND to_currency = 'COP'
     AND month >= ? AND month <= ?`,
    [fromMonth, toMonth],
  );
}

/** Most recent available USD→COP rate (fallback for debt calculations). */
export function useLatestExchangeRate() {
  return useQuery<ExchangeRateRow>(
    `SELECT month, rate FROM exchange_rates
     WHERE from_currency = 'USD' AND to_currency = 'COP'
     ORDER BY month DESC LIMIT 1`,
  );
}
