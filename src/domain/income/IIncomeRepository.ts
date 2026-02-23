import type { Income, IncomeMonth } from './Income';
import type { EntityId, YearMonth } from '../shared/types';

export interface IIncomeRepository {
  /** All active (non-deleted) income definitions for the household. */
  listActive(): Promise<Income[]>;

  getById(id: EntityId): Promise<Income | null>;

  /** All IncomeMonth records for a given month. */
  listMonthRows(month: YearMonth): Promise<IncomeMonth[]>;

  /** IncomeMonth for a specific (incomeId, month) pair. */
  getMonthRow(incomeId: EntityId, month: YearMonth): Promise<IncomeMonth | null>;
}
