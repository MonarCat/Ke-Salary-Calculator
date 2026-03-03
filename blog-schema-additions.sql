-- Blog Schema Additions
-- Run this in your Supabase SQL Editor AFTER running blog-setup.sql
--
-- What this adds:
--   1. profiles table (display_name, avatar_url) with RLS
--   2. handle_new_user() trigger — auto-creates a profile row on signup
--   3. GRANT EXECUTE on get_reaction_counts() to anon + authenticated roles

-- =========================================================
-- 1. profiles table
-- =========================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
CREATE POLICY "Anyone can view profiles" ON profiles
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Auto-update timestamp
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);

-- =========================================================
-- 2. handle_new_user trigger
-- Automatically inserts a profile row whenever a new user
-- signs up through Supabase Auth.
-- =========================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- =========================================================
-- 3. Backfill profiles for existing users
-- One-time migration: creates a profile row for every
-- auth user that doesn't yet have one.
-- =========================================================
INSERT INTO public.profiles (id, display_name)
SELECT
  u.id,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(u.email, '@', 1)
  )
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

-- =========================================================
-- 4. Grant get_reaction_counts() to anon + authenticated
-- The blog page calls this RPC without requiring login.
-- =========================================================
GRANT EXECUTE ON FUNCTION get_reaction_counts(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_reaction_counts(UUID) TO authenticated;

-- Success
DO $$
BEGIN
  RAISE NOTICE 'Blog schema additions applied successfully.';
  RAISE NOTICE 'profiles table created and existing users backfilled.';
  RAISE NOTICE 'handle_new_user trigger is now active.';
  RAISE NOTICE 'get_reaction_counts() RPC is now callable by anon and authenticated roles.';
END $$;
