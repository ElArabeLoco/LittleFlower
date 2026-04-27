import { useMemo } from 'react';
import { useIncomesForMonth, useIncomeMonthsForMonth } from '@/infrastructure/powersync/queries/useIncomeQueries';
import { useExchangeRateForMonth } from '@/infrastructure/powersync/queries/useExchangeRateQueries';
import type { IncomeRow, IncomeMonthRow, ExchangeRateRow } from '@/infrastructure/powersync/queries/types';
import { toCOP } from '@/shared/helpers';

export type { IncomeRow, IncomeMonthRow, ExchangeRateRow };

export interface IncomeSummary {
  /** Incomes active during the requested month, ordered by category+name. */
  incomes: IncomeRow[];
  /** Lookup: income_id → IncomeMonthRow override for the month. */
  imMap: Map<string, IncomeMonthRow>;
  /** Exchange rate record for the month (null if none exists). */
  exchangeRate: ExchangeRateRow | null;
  /** USD→COP rate value for the month (null if none exists). */
  trm: number | null;
  /** Total income converted to COP for the month. */
  totalCOP: number;
  /** True when at least one income source is in a foreign currency. */
  hasUSDIncome: boolean;
  /** True when at least one income is in a foreign currency and no TRM exists. */
  missingTrm: boolean;
}

/**
 * Computes the income summary for a given month.
 * Converts foreign-currency incomes to COP using the month's exchange rate.
 */
export function useIncomeSummary(month: string): IncomeSummary {
  const { data: incomes = [] } = useIncomesForMonth(month);
  const { data: incomeMonths = [] } = useIncomeMonthsForMonth(month);
  const { data: rateRows = [] } = useExchangeRateForMonth(month);

  const exchangeRate = rateRows[0] ?? null;
  const trm = exchangeRate?.rate ?? null;
  const hasUSDIncome = incomes.some(i => i.currency !== 'COP');

  const imMap = useMemo(() => {
    const m = new Map<string, IncomeMonthRow>();
    for (const im of incomeMonths) m.set(im.income_id, im);
    return m;
  }, [incomeMonths]);

  const totalCOP = useMemo(() => {
    return incomes.reduce((sum, inc) => {
      const im = imMap.get(inc.id);
      const amount = im?.real_amount ?? inc.default_amount;
      const currency = im ? im.currency : inc.currency;
      return sum + toCOP(amount, currency, trm);
    }, 0);
  }, [incomes, imMap, trm]);

  const missingTrm = hasUSDIncome && trm === null;

  return { incomes, imMap, exchangeRate, trm, totalCOP, hasUSDIncome, missingTrm };
}
