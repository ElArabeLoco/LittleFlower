import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import type { IncomeRow, IncomeMonthRow, ExchangeRateRow } from './types';

export function useIncomeData(month: string) {
  const { data: incomes = [] } = useQuery<IncomeRow>(
    `SELECT id, name, person, is_fixed, category, default_amount, currency, start_month, end_month
     FROM incomes
     WHERE deleted_at IS NULL
       AND start_month <= ?
       AND (end_month IS NULL OR end_month >= ?)
     ORDER BY category ASC, name ASC`,
    [month, month],
  );

  const { data: incomeMonths = [] } = useQuery<IncomeMonthRow>(
    `SELECT id, income_id, real_amount, currency, note, base_salary, deductions, extra_days
     FROM income_months WHERE month = ?`,
    [month],
  );

  const { data: exchangeRates = [] } = useQuery<ExchangeRateRow>(
    `SELECT id, rate, source FROM exchange_rates
     WHERE from_currency = 'USD' AND to_currency = 'COP' AND month = ?`,
    [month],
  );

  const exchangeRate = exchangeRates[0] ?? null;
  const trm = exchangeRate?.rate ?? null;
  const hasUSDIncome = incomes.some(i => i.currency !== 'COP');

  const imMap = useMemo(() => {
    const m = new Map<string, IncomeMonthRow>();
    for (const im of incomeMonths) m.set(im.income_id, im);
    return m;
  }, [incomeMonths]);

  const totalCOP = useMemo(() => incomes.reduce((sum, inc) => {
    const im = imMap.get(inc.id);
    const amount = im?.real_amount ?? inc.default_amount;
    if (inc.currency === 'COP') return sum + amount;
    if (trm) return sum + Math.round(amount * trm);
    return sum;
  }, 0), [incomes, imMap, trm]);

  const missingTrm = hasUSDIncome && trm === null;

  return { incomes, imMap, exchangeRate, trm, hasUSDIncome, totalCOP, missingTrm };
}
