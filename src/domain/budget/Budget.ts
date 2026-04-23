import type { EntityId, ISODateTime, YearMonth, COPAmount } from '../shared/types';

export type PaymentMode = 'cash' | 'credit_card' | 'both';

export interface Budget {
  id: EntityId;
  householdId: string;
  name: string;
  description: string | null;
  categoryId: string;
  startMonth: YearMonth; // 'YYYY-MM' — active from this month onward
  defaultAmount: COPAmount; // used when no BudgetMonth override exists
  paymentMode: PaymentMode;
  creditCardId: string | null;
  /** FK to debts.id — when set, expenses on this budget auto-create a debt debit transaction */
  debtId: string | null;
  createdBy: string; // userId
  createdAt: ISODateTime;
  deletedAt: ISODateTime | null;
  lastEditedBy: string | null;
  lastEditedAt: ISODateTime | null;
}

export interface BudgetMonth {
  id: EntityId;
  householdId: string;
  budgetId: EntityId;
  month: YearMonth;
  amount: COPAmount;
  isExecuted: boolean;
  notes: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  lastEditedBy: string | null;
  lastEditedAt: ISODateTime | null;
}
