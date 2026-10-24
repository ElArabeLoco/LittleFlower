/**
 * SQL row types for PowerSync reactive queries.
 * These match SQLite column names (snake_case).
 * Use as the generic parameter for useQuery<T>().
 */

export interface BudgetRow {
  id: string;
  name: string;
  description: string | null;
  category_id: string;
  payment_mode: string; // 'cash' | 'credit_card' | 'both'
  default_amount: number;
  household_id: string;
  start_month: string;
  end_month: string | null;
  debt_id: string | null;
}

export interface BudgetMonthRow {
  id: string;
  budget_id: string;
  month: string;
  amount: number;
  is_executed: number; // SQLite integer: 0 | 1
}

export interface ExpenseRow {
  id: string;
  budget_id: string;
  budget_month_id: string;
  household_id: string;
  amount: number;
  note: string | null;
  timestamp: string;
  recorded_by: string;
  created_at: string;
  deleted_at: string | null;
  paid_with_credit_card: number; // SQLite integer: 0 | 1
}

export interface IncomeRow {
  id: string;
  name: string;
  person: string;
  is_fixed: number;
  category: string;
  default_amount: number;
  currency: string;
  start_month: string;
  end_month: string | null;
}

export interface IncomeMonthRow {
  id: string;
  income_id: string;
  month: string;
  real_amount: number;
  currency: string;
  note: string | null;
  base_salary: number;
  deductions: number;
  extra_days: number;
}

export interface ExchangeRateRow {
  id: string;
  household_id: string;
  from_currency: string;
  to_currency: string;
  month: string;
  rate: number;
  source: string;
}

export interface DebtRow {
  id: string;
  name: string;
  description: string | null;
  initial_amount: number;
  currency: string;
  disbursed_at: string;
  household_id: string;
  kind: string;
  lender: string | null;
  interest_rate: number;
  amortization: string;
  term_months: number | null;
  installment_amount: number | null;
  monthly_fees: number;
}

export interface DebtTransactionRow {
  id: string;
  debt_id: string;
  /** Principal portion */
  amount: number;
  interest_amount: number;
  fees_amount: number;
  original_amount: number | null;
  original_currency: string | null;
  exchange_rate: number | null;
  type: string;
  note: string | null;
  date: string;
  source: string;
  expense_id: string | null;
}

export interface HouseholdRow {
  id: string;
  name: string;
  join_code: string | null;
}

export interface UserRow {
  id: string;
  name: string;
  color: string | null;
}

export interface MemberRow {
  id: string;
  name: string;
  /** Raw palette key from SQLite; read it with toMemberTone(). */
  tone: string;
}

/** One holder of an income, a debt or an asset, joined with its active member. */
export interface HolderRow {
  subject_id: string;
  member_id: string;
  name: string;
  tone: string;
}

/** How many active incomes / debts / assets a member holds (one row per subject type). */
export interface MemberHoldingCountRow {
  member_id: string;
  subject_type: string; // 'income' | 'debt' | 'asset'
  n: number;
}

/** One income, debt or asset held by a member. */
export interface MemberHoldingRow {
  subject_type: string; // 'income' | 'debt' | 'asset'
  subject_id: string;
  name: string;
}

export interface HouseholdUserRow {
  id: string;
  name: string;
}

/** One active valuation of an active asset. Currency is raw; read it with toAssetCurrency(). */
export interface AssetValuationRow {
  id: string;
  asset_id: string;
  value: number;
  currency: string;
  valued_on: string;
  note: string | null;
  created_at: string;
}

/** One active asset. Kind and currency are raw; read them with toAssetKind() / toAssetCurrency(). */
export interface AssetRow {
  id: string;
  name: string;
  kind: string;
  value: number;
  currency: string;
}
