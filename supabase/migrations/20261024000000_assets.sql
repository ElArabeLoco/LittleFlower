-- Migration: assets (activos)
--
-- 1. assets: what the household owns (savings, investments, real estate,
--    vehicles, other) at its current value. No depreciation, no history:
--    the value is edited by hand.
-- 2. holders: assets can have holders too (subject_type = 'asset').
--
-- Run this BEFORE any client creates an asset with holders: a holder row
-- rejected by the old CHECK would block the PowerSync upload queue.
-- Additive only: clients that predate this migration keep working.

CREATE TABLE assets (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  household_id   TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  -- savings | investment | real_estate | vehicle | other (no CHECK: an
  -- unknown kind from a newer client must not block the upload queue)
  kind           TEXT NOT NULL DEFAULT 'other',
  -- Integer in the asset's own currency
  value          BIGINT NOT NULL DEFAULT 0,
  currency       TEXT NOT NULL DEFAULT 'COP',
  created_by     TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  last_edited_by TEXT,
  last_edited_at TEXT,
  deleted_at     TEXT
);

CREATE INDEX assets_household_idx ON assets (household_id);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household isolation" ON assets FOR ALL
  USING (household_id = (auth.jwt() -> 'user_metadata' ->> 'household_id'))
  WITH CHECK (household_id = (auth.jwt() -> 'user_metadata' ->> 'household_id'));

-- Holders of assets
ALTER TABLE holders DROP CONSTRAINT IF EXISTS holders_subject_type_check;
ALTER TABLE holders ADD CONSTRAINT holders_subject_type_check
  CHECK (subject_type IN ('income', 'debt', 'asset'));

-- The powersync publication lists its tables one by one.
ALTER PUBLICATION powersync ADD TABLE assets;
