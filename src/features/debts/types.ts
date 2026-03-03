export interface DebtRow {
  id: string;
  name: string;
  description: string | null;
  initial_amount: number;
  currency: string;
  disbursed_at: string;
}

export interface DebtTransactionRow {
  id: string;
  debt_id: string;
  amount: number;
  original_amount: number | null;
  original_currency: string | null;
  exchange_rate: number | null;
  type: string;
  note: string | null;
  date: string;
  source: string;
  expense_id: string | null;
}

export interface ExchangeRateRow {
  month: string;
  rate: number;
}

export interface DebtFormState {
  name: string;
  description: string;
  initial_amount: string;
  currency: string;
  disbursed_at: string;
}

export interface TransactionFormState {
  type: 'debit' | 'credit';
  amount: string;
  currency: string;
  exchange_rate: string;
  date: string;
  note: string;
}
