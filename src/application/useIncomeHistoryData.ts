/**
 * useIncomeHistoryData — reactive income total (COP) for the last N months.
 *
 * Used exclusively by IncomeHistoryChart; lives outside DashboardContext
 * because the range is variable (3/6/12/24/60 months) and independent of
 * the dashboard's selected month.
 */
import { useMemo } from 'react';
import { toCOP, prevNMonthsFrom } from '@/shared/helpers';
import { useActiveIncomes, useIncomeMonthsForMonths } from '@/infrastructure/powersync/queries/useIncomeQueries';
import { useExchangeRatesForMonths } from '@/infrastructure/powersync/queries/useExchangeRateQueries';

export interface IncomeDataPoint {
  month: string;
  income: number;
}

export function useIncomeHistoryData(n: number, currentMonth: string): IncomeDataPoint[] {
  const months = useMemo(() => prevNMonthsFrom(n, currentMonth), [n, currentMonth]);

  const { data: incomes = [] } = useActiveIncomes();
  const { data: incomeMonths = [] } = useIncomeMonthsForMonths(months);
  const { data: exchangeRates = [] } = useExchangeRatesForMonths(months);

  const imMap = useMemo(() => {
    const m = new Map<string, { real_amount: number; currency: string }>();
    for (const im of incomeMonths) m.set(`${im.income_id}|${im.month}`, im);
    return m;
  }, [incomeMonths]);

  const trmMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const er of exchangeRates) m.set(er.month, er.rate);
    return m;
  }, [exchangeRates]);

  return useMemo(() => {
    return months.map(month => {
      const trm = trmMap.get(month) ?? null;
      let income = 0;
      for (const inc of incomes) {
        if (inc.start_month > month) continue;
        if (inc.end_month != null && inc.end_month < month) continue;
        const im = imMap.get(`${inc.id}|${month}`);
        const amount = im ? im.real_amount : inc.default_amount;
        const currency = im ? im.currency : inc.currency;
        income += toCOP(amount, currency, trm);
      }
      return { month, income };
    });
  }, [months, incomes, imMap, trmMap]);
}
