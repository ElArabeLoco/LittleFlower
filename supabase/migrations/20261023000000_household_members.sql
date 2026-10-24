-- Migration: household members and holders (titularidad)
--
-- 1. household_members: the people of the household economy. Not app
--    accounts: a member needs no login and a login creates no member.
-- 2. holders: who an income or a debt is in the name of. Zero or more
--    members per record; no rows means the whole household.
--
-- Additive only: clients that predate this migration keep working.

CREATE TABLE household_members (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  household_id   TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  -- Avatar palette key: petal | iris | leaf | polen | sky | mist
  tone           TEXT NOT NULL DEFAULT 'petal',
  created_by     TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  last_edited_by TEXT,
  last_edited_at TEXT,
  deleted_at     TEXT
);

CREATE INDEX household_members_household_idx ON household_members (household_id);

CREATE TABLE holders (
  -- '<subject_type>:<subject_id>:<member_id>': two devices that assign
  -- the same holder offline write the same row instead of a duplicate.
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  member_id    TEXT NOT NULL REFERENCES household_members(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('income', 'debt')),
  -- incomes.id or debts.id by subject_type (polymorphic: no FK)
  subject_id   TEXT NOT NULL,
  created_by   TEXT NOT NULL,
  created_at   TEXT NOT NULL
);

CREATE INDEX holders_household_idx ON holders (household_id);
CREATE INDEX holders_subject_idx ON holders (subject_type, subject_id);
CREATE INDEX holders_member_idx ON holders (member_id);

ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE holders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household isolation" ON household_members FOR ALL
  USING (household_id = (auth.jwt() -> 'user_metadata' ->> 'household_id'))
  WITH CHECK (household_id = (auth.jwt() -> 'user_metadata' ->> 'household_id'));

CREATE POLICY "household isolation" ON holders FOR ALL
  USING (household_id = (auth.jwt() -> 'user_metadata' ->> 'household_id'))
  WITH CHECK (household_id = (auth.jwt() -> 'user_metadata' ->> 'household_id'));

-- The powersync publication lists its tables one by one.
ALTER PUBLICATION powersync ADD TABLE household_members, holders;
