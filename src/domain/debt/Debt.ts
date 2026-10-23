import type { EntityId, ISODateTime, COPAmount } from '../shared/types';

/** 'personal' = owed to a person (no interest); the rest are financial institutions */
export type DebtKind = 'personal' | 'mortgage' | 'credit_card' | 'loan' | 'other';

/**
 * 'none' = free payments, no schedule (personal debts)
 * 'fixed_installment' = cuota fija (French system)
 * 'fixed_principal' = abono constante a capital (credit card purchases in installments)
 */
export type AmortizationMethod = 'none' | 'fixed_installment' | 'fixed_principal';

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
  kind: DebtKind;
  /** Financial institution name, null for personal debts */
  lender: string | null;
  /** Effective annual rate as a fraction (0.125 = 12.5% E.A.); 0 for personal debts */
  interestRate: number;
  amortization: AmortizationMethod;
  termMonths: number | null;
  /** Agreed installment without fees; null = computed from the loan terms */
  installmentAmount: COPAmount | null;
  /** Insurance / handling fee charged with every installment */
  monthlyFees: COPAmount;
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
  /**
   * Principal portion — the only part that changes the balance.
   * Always COP integer — converted if original currency was USD.
   */
  amount: COPAmount;
  /** Interest portion of a payment (not part of the balance) */
  interestAmount: COPAmount;
  /** Insurance / fees portion of a payment (not part of the balance) */
  feesAmount: COPAmount;
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
