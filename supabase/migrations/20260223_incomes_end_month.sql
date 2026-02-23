-- Add optional end_month to incomes
-- If NULL, the income has no end date (indefinite).
ALTER TABLE incomes
  ADD COLUMN IF NOT EXISTS end_month text DEFAULT NULL;
