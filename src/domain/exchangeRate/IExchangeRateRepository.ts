import type { ExchangeRate } from './ExchangeRate';
import type { YearMonth } from '../shared/types';

export interface IExchangeRateRepository {
  /**
   * All exchange rate records (all months) for the household.
   * The full set is needed so that getEffectiveRate() can do its
   * 12-month fallback lookback in MonthlyMetricsService.
   */
  listAll(): Promise<ExchangeRate[]>;

  /** Rate for a specific (fromCurrency, toCurrency, month) — exact match only. */
  getExact(fromCurrency: string, toCurrency: string, month: YearMonth): Promise<ExchangeRate | null>;
}
