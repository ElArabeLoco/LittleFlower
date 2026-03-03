import { useQuery } from '@powersync/react';
import type { DebtDashRow, DebtTxDashRow, ExchangeRateRow } from './types';

export function useDebtData() {
  const { data: dashDebts = [] } = useQuery<DebtDashRow>(
    `SELECT id, name, initial_amount, currency FROM debts WHERE deleted_at IS NULL`,
  );

  const { data: dashDebtTxs = [] } = useQuery<DebtTxDashRow>(
    `SELECT debt_id, type, amount, date FROM debt_transactions WHERE deleted_at IS NULL ORDER BY date ASC`,
  );

  const { data: latestTrmRows = [] } = useQuery<ExchangeRateRow>(
    `SELECT month, rate FROM exchange_rates
     WHERE from_currency = 'USD' AND to_currency = 'COP'
     ORDER BY month DESC LIMIT 1`,
  );

  const latestTrm = latestTrmRows[0]?.rate ?? null;

  function debtInitialCOP(debt: DebtDashRow): number {
    if (debt.currency === 'COP') return debt.initial_amount;
    const trm = latestTrm ?? 0;
    return Math.round(debt.initial_amount * trm);
  }

  return { dashDebts, dashDebtTxs, latestTrm, debtInitialCOP };
}
