import type { EntityId, ISODateTime, COPAmount } from '../shared/types';

/**
 * Expense — append-only ledger record.
 *
 * Positive amount = recorded expense.
 * Negative amount = reversal of a prior expense record.
 * Net spend for a BudgetMonth = SUM(amount) for all active records.
 *
 * MVP: deletedAt used for soft-delete.
 * Phase 2: no deletedAt; reversals only via negative-amount records.
 */
export interface Expense {
  id: EntityId;
  householdId: string;
  budgetId: EntityId;
  budgetMonthId: EntityId;
  amount: COPAmount; // negative = reversal
  note: string | null;
  recordedBy: string; // userId
  timestamp: ISODateTime; // user-visible date of the expense
  createdAt: ISODateTime; // system timestamp — immutable after creation
  linkedExpenseId: EntityId | null; // set when this record reverses another
  deletedAt: ISODateTime | null; // MVP soft-delete
  paidWithCreditCard: boolean; // mode used for this specific transaction
}
