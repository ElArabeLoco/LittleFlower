-- Migration: dual payment mode for budgets
--
-- 1. Replace budgets.paid_with_credit_card (boolean) with
--    budgets.payment_mode ('cash' | 'credit_card' | 'both').
-- 2. Add expenses.paid_with_credit_card so every transaction records
--    the mode it was paid with (backfilled from parent budget on migration).

-- ── budgets ─────────────────────────────────────────────────────────────────

ALTER TABLE budgets ADD COLUMN payment_mode TEXT
  CHECK (payment_mode IN ('cash', 'credit_card', 'both'));

UPDATE budgets
  SET payment_mode = CASE
    WHEN paid_with_credit_card = TRUE THEN 'credit_card'
    ELSE 'cash'
  END;

ALTER TABLE budgets ALTER COLUMN payment_mode SET NOT NULL;
ALTER TABLE budgets DROP COLUMN paid_with_credit_card;

-- ── expenses ─────────────────────────────────────────────────────────────────

ALTER TABLE expenses ADD COLUMN paid_with_credit_card BOOLEAN;

UPDATE expenses e
  SET paid_with_credit_card = (b.payment_mode = 'credit_card')
  FROM budgets b
  WHERE e.budget_id = b.id;

ALTER TABLE expenses ALTER COLUMN paid_with_credit_card SET NOT NULL;
