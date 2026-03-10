-- Blog Schema Additions: User Profiles Table & Auth Trigger
-- Run this script in the Supabase SQL Editor.
-- Order: after DATABASE_SCHEMA.md setup (user_profiles must exist first).

-- ─────────────────────────────────────────────────────────────────
-- 1. Ensure user_profiles table exists with the correct schema
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id                      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name               TEXT,
  account_type            TEXT CHECK (account_type IN ('individual', 'employer')),
  organization_name       TEXT,
  organization_kra        TEXT,
  phone_number            TEXT,
  payslip_downloads_count INTEGER DEFAULT 0,
  downloads_reset_date    TIMESTAMPTZ DEFAULT NOW(),
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile"   ON user_profiles;
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────────
-- 2. Shared timestamp-update function (idempotent)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────
-- 3. Auto-update trigger for user_profiles
-- ─────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ─────────────────────────────────────────────────────────────────
-- 4. handle_new_user() — called after every new Supabase sign-up.
--    Reads metadata supplied in supabaseClient.auth.signUp({ options: { data: {...} } })
--    and creates the corresponding user_profiles row.
--    ON CONFLICT (id) DO NOTHING makes the function safe to re-run.
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id,
    full_name,
    account_type,
    organization_name
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'account_type', 'individual'),
    NEW.raw_user_meta_data->>'organization_name'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ─────────────────────────────────────────────────────────────────
-- 5. Trigger: fire handle_new_user() after every INSERT on auth.users
--    (i.e., whenever a new account is created).
--    DROP … IF EXISTS ensures a stale/broken trigger is replaced.
-- ─────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

DO $$
BEGIN
  RAISE NOTICE '===================================================';
  RAISE NOTICE 'blog-schema-additions.sql completed successfully.';
  RAISE NOTICE 'The on_auth_user_created trigger is now active.';
  RAISE NOTICE 'New user sign-ups will automatically receive a';
  RAISE NOTICE 'user_profiles row with their name and account type.';
  RAISE NOTICE '===================================================';
END $$;
