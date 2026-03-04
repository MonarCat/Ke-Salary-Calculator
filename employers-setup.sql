-- Employers Table Setup
-- Run this script in the Supabase SQL Editor to create the employers table.
-- This table stores organisation-specific profile data for employer accounts
-- and complements the existing employees table (which stores the employer's staff).

-- ─────────────────────────────────────────────────
-- 1. Create the employers table
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_name    TEXT NOT NULL,
  organization_kra_pin TEXT,
  registration_number  TEXT,
  business_type        TEXT CHECK (business_type IN (
                         'sole_proprietor', 'partnership',
                         'limited_company', 'ngo', 'government', 'other'
                       )),
  industry             TEXT,
  county               TEXT,
  physical_address     TEXT,
  postal_address       TEXT,
  contact_email        TEXT,
  contact_phone        TEXT,
  website              TEXT,
  logo_url             TEXT,
  employee_limit       INTEGER DEFAULT 1000 CHECK (employee_limit > 0),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- 2. Enable Row Level Security
-- ─────────────────────────────────────────────────
ALTER TABLE employers ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────
-- 3. RLS Policies
-- ─────────────────────────────────────────────────

-- Employers can view their own record
DROP POLICY IF EXISTS "Employers can view own record" ON employers;
CREATE POLICY "Employers can view own record" ON employers
  FOR SELECT USING (auth.uid() = user_id);

-- Employers can create their own record
DROP POLICY IF EXISTS "Employers can insert own record" ON employers;
CREATE POLICY "Employers can insert own record" ON employers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Employers can update their own record
DROP POLICY IF EXISTS "Employers can update own record" ON employers;
CREATE POLICY "Employers can update own record" ON employers
  FOR UPDATE USING (auth.uid() = user_id);

-- Employers can delete their own record
DROP POLICY IF EXISTS "Employers can delete own record" ON employers;
CREATE POLICY "Employers can delete own record" ON employers
  FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────
-- 4. Index for fast lookups by user_id
-- ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_employers_user_id ON employers(user_id);

-- ─────────────────────────────────────────────────
-- 5. Auto-update timestamp trigger
--    Requires the update_updated_at() function which
--    is already created by DATABASE_SCHEMA.md setup.
-- ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS update_employers_updated_at ON employers;
CREATE TRIGGER update_employers_updated_at
  BEFORE UPDATE ON employers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
