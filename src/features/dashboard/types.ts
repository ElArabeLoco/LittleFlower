// SQL row types for dashboard queries

export interface BudgetRow {
  id: string;
  name: string;
  category_id: string;
  payment_mode: string; // 'cash' | 'credit_card' | 'both'
  default_amount: number;
  start_month: string;
  end_month: string | null;
}

export interface BudgetMonthRow {
  budget_id: string;
  month: string;
  amount: number;
}

export interface ExpenseSumRow {
  budget_month_id: string;
  month: string;
  total: number;
}

export interface BudgetMonthIdRow {
  id: string;
  budget_id: string;
  month: string;
  amount: number;
}

export interface IncomeRow {
  id: string;
  default_amount: number;
  currency: string;
  start_month: string;
  end_month: string | null;
}

export interface IncomeMonthRow {
  income_id: string;
  month: string;
  real_amount: number;
  currency: string;
}

export interface ExchangeRateRow {
  month: string;
  rate: number;
}

export interface RecentExpenseRow {
  id: string;
  amount: number;
  note: string | null;
  timestamp: string;
  budget_name: string;
  category_id: string;
}

export interface DebtDashRow {
  id: string;
  name: string;
  initial_amount: number;
  currency: string;
}

export interface DebtTxDashRow {
  debt_id: string;
  type: string;
  amount: number;
  date: string;
}

export interface DailyExpenseRow {
  day: string; // 'YYYY-MM-DD'
  total: number;
}

export interface BurnUpExpenseRow {
  day: string; // 'YYYY-MM-DD'
  total: number;
}

export interface BurnUpDataPoint {
  day: number;
  label: string;
  ideal: number;
  current: number | null; // null after today (no data yet)
  previous: number | null;
}

export interface ExceededRow {
  budgetId: string;
  name: string;
  emoji: string;
  color: string;
  isCreditCard: boolean;
  month: string;
  label: string;
  budgeted: number;
  spent: number;
  overage: number;
  pct: number;
}
