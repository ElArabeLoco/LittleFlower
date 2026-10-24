-- Migration: asset_valuations (historial de valor de activos)
--
-- Every value an asset has had, written by hand when the household learns
-- it changed (a property appreciated, a vehicle depreciated). No automatic
-- depreciation. assets.value / assets.currency stay as the current value:
-- the latest valuation by valued_on, then created_at.
--
-- Backfill: one valuation per existing asset with its current value, dated
-- on the day it was created. Its id is 'initial:<asset id>', the same id
-- clients write for an asset's first valuation, so it is never duplicated.
--
-- Run this BEFORE deploying the client that writes valuations: an upload
-- rejected by Postgres blocks the PowerSync queue. Additive only.
--
-- After running it, add to the PowerSync sync rules:
--   SELECT * FROM asset_valuations WHERE household_id = bucket.household_id

CREATE TABLE asset_valuations (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  -- No FK to assets: a valuation uploaded before its asset must not be
  -- rejected (it would block the upload queue).
  asset_id     TEXT NOT NULL,
  -- Integer in `currency`
  value        BIGINT NOT NULL DEFAULT 0,
  currency     TEXT NOT NULL DEFAULT 'COP',
  -- YYYY-MM-DD: the day this value was known
  valued_on    TEXT NOT NULL,
  note         TEXT,
  created_by   TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  deleted_at   TEXT
);

CREATE INDEX asset_valuations_household_idx ON asset_valuations (household_id);
CREATE INDEX asset_valuations_asset_idx ON asset_valuations (asset_id);

ALTER TABLE asset_valuations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household isolation" ON asset_valuations FOR ALL
  USING (household_id = (auth.jwt() -> 'user_metadata' ->> 'household_id'))
  WITH CHECK (household_id = (auth.jwt() -> 'user_metadata' ->> 'household_id'));

INSERT INTO asset_valuations (id, household_id, asset_id, value, currency, valued_on, created_by, created_at)
SELECT 'initial:' || id, household_id, id, value, currency, substr(created_at, 1, 10), created_by, created_at
FROM assets
ON CONFLICT (id) DO NOTHING;

-- The powersync publication lists its tables one by one.
ALTER PUBLICATION powersync ADD TABLE asset_valuations;
