import type { Debt, DebtTransaction } from './Debt';

export interface IDebtRepository {
  listActive(): Promise<Debt[]>;
  getById(id: string): Promise<Debt | null>;
  listTransactions(debtId: string): Promise<DebtTransaction[]>;
  /** All transactions across all debts — used by the dashboard */
  listAllTransactions(): Promise<DebtTransaction[]>;
}
