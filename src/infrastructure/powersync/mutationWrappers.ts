/**
 * mutationWrappers — barrel re-export for all PowerSync write operations.
 *
 * Implementations live in the individual repository files under repositories/.
 * Import from this file to get a single stable entry point for all mutations.
 *
 * PowerSync model:
 *   - db.execute() writes to the local SQLite first (instant, offline-safe)
 *   - PowerSync queues the change and flushes it to Supabase via uploadData()
 *     when the device is online
 *
 * ALL writes to the local SQLite database go through these exports.
 * Never call db.execute() or db.writeTransaction() directly from use cases
 * or UI code.
 */

export {
  insertBudget,
  updateBudget,
  deleteBudget,
  upsertBudgetMonth,
  updateBudgetMonthExecution,
  registerFullPaymentAndExecute,
  applyBudgetMonthAmountForward,
  type InsertBudgetPayload,
  type UpsertBudgetMonthPayload,
  type RegisterFullPaymentPayload,
  type ApplyForwardPayload,
} from './repositories/PowerSyncBudgetRepository';

export {
  recordExpense,
  softDeleteExpense,
  type RecordExpensePayload,
} from './repositories/PowerSyncExpenseRepository';

export {
  insertIncome,
  updateIncome,
  deleteIncome,
  upsertIncomeMonth,
  type InsertIncomePayload,
  type UpsertIncomeMonthPayload,
} from './repositories/PowerSyncIncomeRepository';

export {
  upsertExchangeRate,
  updateExchangeRate,
  type UpsertExchangeRatePayload,
} from './repositories/PowerSyncExchangeRateRepository';

export {
  insertDebt,
  updateDebt,
  softDeleteDebt,
  insertDebtTransaction,
  softDeleteDebtTransaction,
  type InsertDebtPayload,
  type InsertDebtTransactionPayload,
} from './repositories/PowerSyncDebtRepository';
