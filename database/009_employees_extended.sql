-- Migration: extend employees table with additional fields used by employees.html
-- Run this in your Supabase SQL Editor after DATABASE_SCHEMA.md setup.

-- Ensure the employees table exists (idempotent create, matches DATABASE_SCHEMA.md)
CREATE TABLE IF NOT EXISTS employees (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  employee_id   TEXT NOT NULL,
  kra_pin       TEXT,
  email         TEXT,
  phone_number  TEXT,
  department    TEXT,
  position      TEXT,
  gross_salary  NUMERIC(10, 2) DEFAULT 0,
  allowances    NUMERIC(10, 2) DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employer_id, employee_id)
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Add columns introduced by the UI that are absent from the original schema
ALTER TABLE employees ADD COLUMN IF NOT EXISTS status           TEXT DEFAULT 'Active';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_name        TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_branch      TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS account_name     TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS account_number   TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS nok_name         TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS nok_relationship TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS nok_phone        TEXT;

-- RLS policies (idempotent)
DROP POLICY IF EXISTS "Employers can view own employees"   ON employees;
DROP POLICY IF EXISTS "Employers can insert own employees" ON employees;
DROP POLICY IF EXISTS "Employers can update own employees" ON employees;
DROP POLICY IF EXISTS "Employers can delete own employees" ON employees;

CREATE POLICY "Employers can view own employees"   ON employees FOR SELECT USING (auth.uid() = employer_id);
CREATE POLICY "Employers can insert own employees" ON employees FOR INSERT WITH CHECK (auth.uid() = employer_id);
CREATE POLICY "Employers can update own employees" ON employees FOR UPDATE USING (auth.uid() = employer_id);
CREATE POLICY "Employers can delete own employees" ON employees FOR DELETE USING (auth.uid() = employer_id);

-- Index for fast employer lookups
CREATE INDEX IF NOT EXISTS idx_employees_employer_id ON employees(employer_id);

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_employees_updated_at ON employees;
CREATE TRIGGER set_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
