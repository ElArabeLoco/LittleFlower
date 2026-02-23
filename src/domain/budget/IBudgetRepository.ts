import type { Budget, BudgetMonth } from './Budget';
import type { YearMonth, EntityId } from '../shared/types';

export interface IBudgetRepository {
  /** All active (non-deleted) budgets for the household. */
  listActive(): Promise<Budget[]>;

  /** All budgets including soft-deleted ones (for audit/admin). */
  listAll(): Promise<Budget[]>;

  getById(id: EntityId): Promise<Budget | null>;

  /** All BudgetMonth records for a given month. */
  listMonthRows(month: YearMonth): Promise<BudgetMonth[]>;

  /** BudgetMonth for a specific (budgetId, month) cell. */
  getMonthRow(budgetId: EntityId, month: YearMonth): Promise<BudgetMonth | null>;
}
