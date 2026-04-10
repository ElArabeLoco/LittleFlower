export interface FlorecitaExport {
  _format: 'florecita-backup';
  _v: 1;
  _exported_at: string;
  _app_version: string;
  _household_id: string;
  households: Record<string, unknown>[];
  users: Record<string, unknown>[];
  budgets: Record<string, unknown>[];
  budget_months: Record<string, unknown>[];
  expenses: Record<string, unknown>[];
  incomes: Record<string, unknown>[];
  income_months: Record<string, unknown>[];
  exchange_rates: Record<string, unknown>[];
  debts: Record<string, unknown>[];
  debt_transactions: Record<string, unknown>[];
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}
