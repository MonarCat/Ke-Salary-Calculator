-- Employees Extra Columns Migration
-- Run this in your Supabase SQL Editor AFTER the main database schema is set up.
--
-- Adds the columns needed by employees.html that were missing from the original
-- employees table definition.  All columns are nullable so existing rows are
-- unaffected.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS status          TEXT    DEFAULT 'Active'
                                             CHECK (status IN ('Active', 'Off', 'Suspended', 'Terminated')),
  ADD COLUMN IF NOT EXISTS bank_name       TEXT,
  ADD COLUMN IF NOT EXISTS bank_branch     TEXT,
  ADD COLUMN IF NOT EXISTS account_name    TEXT,
  ADD COLUMN IF NOT EXISTS account_number  TEXT,
  ADD COLUMN IF NOT EXISTS nok_name        TEXT,
  ADD COLUMN IF NOT EXISTS nok_relationship TEXT,
  ADD COLUMN IF NOT EXISTS nok_phone       TEXT;
