import type { EntityId, ISODateTime, YearMonth } from '../shared/types';

export type IncomeCategory = 'Salario' | 'Renta' | 'Otro';

/** Recurring income definition — e.g. "Jaime salary (USD)". */
export interface Income {
  id: EntityId;
  householdId: string;
  name: string;
  person: string; // userId of the recipient
  isFixed: boolean;
  category: IncomeCategory;
  defaultAmount: number; // integer, in income's native currency
  currency: string; // ISO 4217
  startMonth: YearMonth;
  endMonth: YearMonth | null; // null = indefinite
  createdBy: string;
  createdAt: ISODateTime;
  deletedAt: ISODateTime | null;
}

/** Actual income recorded for a specific month. */
export interface IncomeMonth {
  id: EntityId;
  householdId: string;
  incomeId: EntityId;
  month: YearMonth;
  realAmount: number; // integer, in income's native currency
  currency: string; // ISO 4217 — denormalized from Income
  note: string | null;
  updatedAt: ISODateTime;
  lastEditedBy: string | null;
  lastEditedAt: ISODateTime | null;
}
