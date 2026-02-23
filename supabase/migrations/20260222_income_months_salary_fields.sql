-- Migration: add salary breakdown fields to income_months
--
-- These three columns store the components of a salary income for a given month.
-- Only populated when the parent income.category = 'Salario'.
-- Default 0 ensures backward compatibility with existing rows.
--
-- Formula:
--   real_amount = base_salary - deductions + ROUND(extra_days * base_salary * 12.0 / 260)

ALTER TABLE income_months
  ADD COLUMN IF NOT EXISTS base_salary  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deductions   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_days   integer NOT NULL DEFAULT 0;

-- Update PowerSync publication so the new columns are included in the sync payload.
-- (PowerSync reads the Postgres publication to know which columns to sync.)
-- If using a wildcard publication (FOR TABLE income_months) this is automatic.
-- If using a column-list publication, run:
--   ALTER PUBLICATION powersync SET TABLE income_months (
--     id, household_id, income_id, month, real_amount, currency, note,
--     base_salary, deductions, extra_days,
--     updated_at, last_edited_by, last_edited_at
--   );
-- Uncomment and adapt the ALTER PUBLICATION statement above if needed.
