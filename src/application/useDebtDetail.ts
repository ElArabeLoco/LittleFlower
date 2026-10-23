import { useMemo } from 'react';
import { toCOP } from '@/shared/helpers';
import { computeDebtBalance } from '@/domain/debt/Debt';
import {
  useDebtByIdQuery,
  useDebtTransactionsForDebtQuery,
} from '@/infrastructure/powersync/queries/useDebtQueries';
import { useLatestExchangeRate } from '@/infrastructure/powersync/queries/useExchangeRateQueries';
import type { DebtRow, DebtTransactionRow } from '@/infrastructure/powersync/queries/types';
import { isFinancialDebt } from './debtPlan';

export interface DebtDetail {
  debt: DebtRow | null;
  /** Descending date */
  transactions: DebtTransactionRow[];
  initialCOP: number;
  /** Outstanding principal in COP */
  balance: number;
  isFinancial: boolean;
}

/** One debt with its transactions and current balance. Empty when `debtId` is not set. */
export function useDebtDetail(debtId: string | null | undefined): DebtDetail {
  const { data: debtRows = [] } = useDebtByIdQuery(debtId ?? '');
  const { data: transactions = [] } = useDebtTransactionsForDebtQuery(debtId ?? '');
  const { data: rateRows = [] } = useLatestExchangeRate();

  const debt = debtRows[0] ?? null;
  const latestTrm = rateRows[0]?.rate ?? null;

  return useMemo(() => {
    const initialCOP = debt ? toCOP(debt.initial_amount, debt.currency, latestTrm) : 0;
    const balance = computeDebtBalance(
      initialCOP,
      transactions.map(tx => ({ type: tx.type as 'debit' | 'credit', amount: tx.amount })),
    );
    return { debt, transactions, initialCOP, balance, isFinancial: !!debt && isFinancialDebt(debt.kind) };
  }, [debt, transactions, latestTrm]);
}
