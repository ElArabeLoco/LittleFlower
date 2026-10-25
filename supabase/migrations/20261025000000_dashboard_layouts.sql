-- Migration: dashboard layouts (dashboard configurable)
--
-- dashboard_layouts: one row per user with the order and width of the widgets
-- on their dashboard. The row id is the user id. No row means the default
-- layout, so users who never customise anything never write here.
--
-- Run this, and add the PowerSync sync rule below, BEFORE any client with the
-- configurable dashboard saves a layout: an upload rejected because the table
-- does not exist blocks the PowerSync upload queue.
--
--   SELECT * FROM dashboard_layouts WHERE household_id = bucket.household_id
--
-- Additive only: clients that predate this migration keep working.

CREATE TABLE dashboard_layouts (
  id             TEXT PRIMARY KEY,
  household_id   TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL,
  -- JSON: {"v":1,"items":[{"id":"trend","width":"half"}, ...]}. Validated by
  -- the client when read; no CHECK, so a newer client's shape never blocks the
  -- upload queue.
  layout         TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  last_edited_by TEXT,
  last_edited_at TEXT
);

CREATE INDEX dashboard_layouts_household_idx ON dashboard_layouts (household_id);

ALTER TABLE dashboard_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household isolation" ON dashboard_layouts FOR ALL
  USING (household_id = (auth.jwt() -> 'user_metadata' ->> 'household_id'))
  WITH CHECK (household_id = (auth.jwt() -> 'user_metadata' ->> 'household_id'));

-- The powersync publication lists its tables one by one.
ALTER PUBLICATION powersync ADD TABLE dashboard_layouts;
