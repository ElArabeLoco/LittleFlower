-- Add optional end_month to budgets
-- If NULL, the budget has no end date (indefinite).
ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS end_month text DEFAULT NULL;
