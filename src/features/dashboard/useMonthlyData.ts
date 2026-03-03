import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { makeShortMonth } from './helpers';
import { useBudgetBaseData } from './useBudgetBaseData';
import type { IncomeRow, IncomeMonthRow, ExchangeRateRow } from './types';

export interface MonthlyDataPoint {
  month: string;
  label: string;
  available: number;
  budgeted: number;
  spent: number;
  balance: number;
  pending: number;
}

export function useMonthlyData() {
  const { t } = useI18n();
  const shortMonth = makeShortMonth(t);
  const { budgets, bmIdMap, expenseByBmId, budgetAmountMap, last6, currentMonth } = useBudgetBaseData();

  const { data: incomes = [] } = useQuery<IncomeRow>(
    `SELECT id, default_amount, currency, start_month, end_month FROM incomes WHERE deleted_at IS NULL`,
  );

  const { data: incomeMonths = [] } = useQuery<IncomeMonthRow>(
    `SELECT income_id, month, real_amount, currency
     FROM income_months WHERE month IN (${last6.map(() => '?').join(',')})`,
    last6,
  );

  const { data: exchangeRates = [] } = useQuery<ExchangeRateRow>(
    `SELECT month, rate FROM exchange_rates
     WHERE from_currency = 'USD' AND to_currency = 'COP'
     AND month IN (${last6.map(() => '?').join(',')})`,
    last6,
  );

  const imMap = useMemo(() => {
    const m = new Map<string, IncomeMonthRow>();
    for (const im of incomeMonths) m.set(`${im.income_id}|${im.month}`, im);
    return m;
  }, [incomeMonths]);

  const trmMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const er of exchangeRates) m.set(er.month, er.rate);
    return m;
  }, [exchangeRates]);

  const monthlyData: MonthlyDataPoint[] = useMemo(() => {
    return last6.map(month => {
      const trm = trmMap.get(month) ?? null;

      let available = 0;
      for (const inc of incomes) {
        if (inc.start_month > month) continue;
        if (inc.end_month != null && inc.end_month < month) continue;
        const im = imMap.get(`${inc.id}|${month}`);
        const amount = im ? im.real_amount : inc.default_amount;
        const currency = im ? im.currency : inc.currency;
        if (currency === 'COP') available += amount;
        else if (trm) available += Math.round(amount * trm);
      }

      let budgeted = 0, spent = 0;
      for (const b of budgets) {
        if (b.paid_with_credit_card === 1) continue;
        if (b.start_month > month) continue;
        if (b.end_month && b.end_month < month) continue;
        const bmKey = `${b.id}|${month}`;
        const bmRow = bmIdMap.get(bmKey);
        const amount = budgetAmountMap.get(bmKey) ?? b.default_amount;
        budgeted += amount;
        if (bmRow) spent += expenseByBmId.get(bmRow.id) ?? 0;
      }

      const balance = available - budgeted;
      const pending = Math.max(0, budgeted - spent);

      return { month, label: shortMonth(month), available, budgeted, spent, balance, pending };
    });
  }, [last6, budgets, incomes, budgetAmountMap, bmIdMap, expenseByBmId, imMap, trmMap, shortMonth]);

  return { monthlyData, currentMonth, last6, budgets };
}
