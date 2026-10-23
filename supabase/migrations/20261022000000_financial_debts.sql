-- Migration: financial debts (interest rate + amortization)
--
-- 1. debts gains loan terms. Existing rows become kind='personal',
--    interest_rate=0 and amortization='none' — same behaviour as before.
-- 2. debt_transactions splits each payment: amount stays the principal (the
--    only part that reduces the balance); interest_amount and fees_amount
--    record the rest of the installment.
--
-- Additive only: clients that predate this migration keep working.

-- ── debts ───────────────────────────────────────────────────────────────────

ALTER TABLE debts
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'personal'
    CHECK (kind IN ('personal', 'mortgage', 'credit_card', 'loan', 'other')),
  ADD COLUMN lender TEXT,
  -- Effective annual rate as a fraction: 0.125 = 12.5% E.A.
  ADD COLUMN interest_rate DOUBLE PRECISION NOT NULL DEFAULT 0
    CHECK (interest_rate >= 0),
  ADD COLUMN amortization TEXT NOT NULL DEFAULT 'none'
    CHECK (amortization IN ('none', 'fixed_installment', 'fixed_principal')),
  ADD COLUMN term_months INTEGER
    CHECK (term_months IS NULL OR term_months > 0),
  -- Agreed installment without fees; computed by the client when NULL
  ADD COLUMN installment_amount INTEGER
    CHECK (installment_amount IS NULL OR installment_amount > 0),
  -- Insurance / handling fee charged with every installment
  ADD COLUMN monthly_fees INTEGER NOT NULL DEFAULT 0
    CHECK (monthly_fees >= 0);

-- ── debt_transactions ───────────────────────────────────────────────────────

ALTER TABLE debt_transactions
  ADD COLUMN interest_amount INTEGER NOT NULL DEFAULT 0
    CHECK (interest_amount >= 0),
  ADD COLUMN fees_amount INTEGER NOT NULL DEFAULT 0
    CHECK (fees_amount >= 0);
