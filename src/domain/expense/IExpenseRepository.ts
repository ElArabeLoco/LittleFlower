import type { Expense } from './Expense';
import type { EntityId, YearMonth } from '../shared/types';

export interface IExpenseRepository {
  /** All active (non-soft-deleted) expenses for a given month. */
  listActiveByMonth(month: YearMonth): Promise<Expense[]>;

  /** All expense records for a specific BudgetMonth (including soft-deleted, for audit). */
  listByBudgetMonth(budgetMonthId: EntityId): Promise<Expense[]>;
}
