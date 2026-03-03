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
  real_amount: number;
  currency: string;
  note: string | null;
  base_salary: number;
  deductions: number;
  extra_days: number;
}

export interface ExchangeRateRow {
  id: string;
  rate: number;
  source: string;
}

export interface IncomeFormState {
  name: string;
  category: string;
  default_amount: string;
  currency: string;
  is_fixed: boolean;
  start_month: string;
  end_month: string;
}
