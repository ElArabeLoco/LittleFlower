import type { EntityId, ISODateTime, COPAmount } from '../shared/types';

export interface Debt {
  id: EntityId;
  householdId: string;
  name: string;
  description: string | null;
  /** Original disbursed amount — always in the debt's own currency (COP or USD integer) */
  initialAmount: number;
  /** ISO 4217: 'COP' | 'USD' */
  currency: string;
  /** 'YYYY-MM-DD' */
  disbursedAt: string;
  createdBy: string;
  createdAt: ISODateTime;
  deletedAt: ISODateTime | null;
  updatedAt: ISODateTime;
  lastEditedBy: string | null;
  lastEditedAt: ISODateTime | null;
}

/** 'debit' = abono/payment (reduces balance), 'credit' = increase (grows balance) */
export type DebtTransactionType = 'debit' | 'credit';

/** 'manual' = entered directly in Debts page, 'expense' = auto-created from a linked budget expense */
export type DebtTransactionSource = 'manual' | 'expense';

export interface DebtTransaction {
  id: EntityId;
  householdId: string;
  debtId: EntityId;
  /** Always COP integer — converted if original currency was USD */
  amount: COPAmount;
  /** Original amount in foreign currency (integer), null if COP */
  originalAmount: number | null;
  /** e.g. 'USD', null if transaction was in COP */
  originalCurrency: string | null;
  /** TRM used for conversion, null if COP */
  exchangeRate: number | null;
  type: DebtTransactionType;
  note: string | null;
  /** 'YYYY-MM-DD' */
  date: string;
  source: DebtTransactionSource;
  /** Set when source='expense' — points to expenses.id */
  expenseId: EntityId | null;
  createdBy: string;
  createdAt: ISODateTime;
  deletedAt: ISODateTime | null;
}

/**
 * Computes the current balance of a debt given its transactions.
 * balance = initialAmountInCOP + SUM(credit.amount) - SUM(debit.amount)
 */
export function computeDebtBalance(
  initialAmountCOP: COPAmount,
  transactions: Pick<DebtTransaction, 'type' | 'amount'>[],
): COPAmount {
  return transactions.reduce((bal, tx) => {
    return tx.type === 'credit' ? bal + tx.amount : bal - tx.amount;
  }, initialAmountCOP);
}
