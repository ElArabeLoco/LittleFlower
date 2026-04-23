import type { PaymentMode } from '@/domain/budget/Budget';

export interface BudgetRow {
  id: string;
  name: string;
  description: string | null;
  category_id: string;
  start_month: string;
  end_month: string | null;
  default_amount: number;
  payment_mode: string;
  household_id: string;
  debt_id: string | null;
}

export interface DebtOption {
  id: string;
  name: string;
}

export interface BudgetFormState {
  name: string;
  description: string;
  category_id: string;
  start_month: string;
  end_month: string;
  default_amount: string;
  payment_mode: PaymentMode;
  debt_id: string;
}
