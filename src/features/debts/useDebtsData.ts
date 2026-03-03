import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import { computeDebtBalance } from '@/domain/debt/Debt';
import type { DebtRow, DebtTransactionRow, ExchangeRateRow } from './types';

export function useDebtsData() {
  const { data: debts = [] } = useQuery<DebtRow>(
    `SELECT id, name, description, initial_amount, currency, disbursed_at
     FROM debts WHERE deleted_at IS NULL ORDER BY disbursed_at DESC`,
  );

  const { data: allTransactions = [] } = useQuery<DebtTransactionRow>(
    `SELECT id, debt_id, amount, original_amount, original_currency, exchange_rate,
            type, note, date, source, expense_id
     FROM debt_transactions WHERE deleted_at IS NULL ORDER BY date DESC, created_at DESC`,
  );

  const { data: rateRows = [] } = useQuery<ExchangeRateRow>(
    `SELECT month, rate FROM exchange_rates
     WHERE from_currency = 'USD' AND to_currency = 'COP'
     ORDER BY month DESC LIMIT 1`,
  );

  const currentMonthRate = rateRows[0]?.rate ?? null;

  const txByDebt = useMemo(() => {
    const map = new Map<string, DebtTransactionRow[]>();
    for (const tx of allTransactions) {
      const list = map.get(tx.debt_id) ?? [];
      list.push(tx);
      map.set(tx.debt_id, list);
    }
    return map;
  }, [allTransactions]);

  const totalBalance = useMemo(() => {
    return debts.reduce((sum, debt) => {
      const txs = txByDebt.get(debt.id) ?? [];
      let initialCOP = debt.initial_amount;
      if (debt.currency === 'USD' && currentMonthRate) {
        initialCOP = Math.round(debt.initial_amount * currentMonthRate);
      }
      const bal = computeDebtBalance(initialCOP, txs.map(tx => ({ type: tx.type as 'debit' | 'credit', amount: tx.amount })));
      return sum + Math.max(0, bal);
    }, 0);
  }, [debts, txByDebt, currentMonthRate]);

  const activeDebts = useMemo(() => debts.filter(d => {
    const txs = txByDebt.get(d.id) ?? [];
    let initialCOP = d.initial_amount;
    if (d.currency === 'USD' && currentMonthRate) {
      initialCOP = Math.round(d.initial_amount * currentMonthRate);
    }
    const bal = computeDebtBalance(initialCOP, txs.map(tx => ({ type: tx.type as 'debit' | 'credit', amount: tx.amount })));
    return bal > 0;
  }), [debts, txByDebt, currentMonthRate]);

  return { debts, txByDebt, currentMonthRate, totalBalance, activeDebts };
}
