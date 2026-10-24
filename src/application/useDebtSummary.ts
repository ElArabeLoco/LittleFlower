import { useMemo, useCallback } from 'react';
import { toCOP } from '@/shared/helpers';
import {
  useDebtsQuery,
  useDebtTransactionsQuery,
  useDashboardDebtsQuery,
  useDashboardDebtTxsQuery,
  type DashboardDebtRow,
  type DashboardDebtTxRow,
} from '@/infrastructure/powersync/queries/useDebtQueries';
import { useLatestExchangeRate } from '@/infrastructure/powersync/queries/useExchangeRateQueries';
import { computeDebtBalance } from '@/domain/debt/Debt';
import type { DebtRow, DebtTransactionRow } from '@/infrastructure/powersync/queries/types';

export type { DebtRow, DebtTransactionRow, DashboardDebtRow, DashboardDebtTxRow };

export interface DebtManagementSummary {
  debts: DebtRow[];
  /** Lookup: debt_id → DebtTransactionRow[] (descending date). */
  txByDebt: Map<string, DebtTransactionRow[]>;
  currentMonthRate: number | null;
  /** Outstanding balance of each active debt in COP (may be < 0 when overpaid). */
  balanceByDebt: Map<string, number>;
  /** Total outstanding balance across all active debts, converted to COP. */
  totalBalance: number;
  /** Debts whose current balance is > 0 (still owed). */
  activeDebts: DebtRow[];
}

/**
 * Full debt summary for the debt management page.
 * Computes per-debt balances using the domain's computeDebtBalance().
 */
export function useDebtManagementSummary(): DebtManagementSummary {
  const { data: debts = [] } = useDebtsQuery();
  const { data: allTransactions = [] } = useDebtTransactionsQuery();
  const { data: rateRows = [] } = useLatestExchangeRate();

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

  const getInitialCOP = useCallback(
    (debt: DebtRow): number => {
      return toCOP(debt.initial_amount, debt.currency, currentMonthRate);
    },
    [currentMonthRate],
  );

  const balanceByDebt = useMemo(() => {
    const map = new Map<string, number>();
    for (const debt of debts) {
      const txs = txByDebt.get(debt.id) ?? [];
      map.set(debt.id, computeDebtBalance(
        getInitialCOP(debt),
        txs.map(tx => ({ type: tx.type as 'debit' | 'credit', amount: tx.amount })),
      ));
    }
    return map;
  }, [debts, txByDebt, getInitialCOP]);

  const totalBalance = useMemo(() => {
    let sum = 0;
    for (const bal of balanceByDebt.values()) sum += Math.max(0, bal);
    return sum;
  }, [balanceByDebt]);

  const activeDebts = useMemo(
    () => debts.filter(debt => (balanceByDebt.get(debt.id) ?? 0) > 0),
    [debts, balanceByDebt],
  );

  return { debts, txByDebt, currentMonthRate, balanceByDebt, totalBalance, activeDebts };
}

// ---------------------------------------------------------------------------
// Dashboard variant (lightweight — only fields needed for the widget)
// ---------------------------------------------------------------------------

export interface DashboardDebtSummary {
  dashDebts: DashboardDebtRow[];
  dashDebtTxs: DashboardDebtTxRow[];
  latestTrm: number | null;
  /** Converts a dashboard debt's initial_amount to COP using the latest TRM. */
  debtInitialCOP: (debt: DashboardDebtRow) => number;
}

/**
 * Lightweight debt data for the dashboard widget.
 * Uses the latest available TRM for currency conversion.
 */
export function useDashboardDebtSummary(): DashboardDebtSummary {
  const { data: dashDebts = [] } = useDashboardDebtsQuery();
  const { data: dashDebtTxs = [] } = useDashboardDebtTxsQuery();
  const { data: rateRows = [] } = useLatestExchangeRate();

  const latestTrm = rateRows[0]?.rate ?? null;

  const debtInitialCOP = useMemo(
    () => (debt: DashboardDebtRow): number => {
      return toCOP(debt.initial_amount, debt.currency, latestTrm);
    },
    [latestTrm],
  );

  return useMemo(() => ({
    dashDebts,
    dashDebtTxs,
    latestTrm,
    debtInitialCOP,
  }), [dashDebts, dashDebtTxs, latestTrm, debtInitialCOP]);
}
