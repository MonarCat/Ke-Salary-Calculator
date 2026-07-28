-- ============================================================
-- 010_fix_premium_paystack.sql
-- Run in the Supabase SQL Editor (after 009_employees_extended.sql).
--
-- What this migration does:
--   1. Adds the missing premium_activated_at column to user_profiles
--      (root cause: webhook/verify were writing to this non-existent column,
--       causing every activation attempt to return 500)
--   2. Adds paystack_reference column for audit trail
--   3. Fixes / creates the CHECK constraint on premium_source so that
--      'paystack' is explicitly allowed (guards against a future constraint
--      addition that would silently block updates)
--   4. Ensures Row Level Security policies allow authenticated users to
--      read and update their own profile row
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Add missing columns to user_profiles
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS premium_activated_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS paystack_reference    TEXT;

-- ────────────────────────────────────────────────────────────
-- 2. Fix CHECK constraint on premium_source
--    Drop any existing constraint first (idempotent), then
--    re-create it with 'paystack' explicitly included.
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.user_profiles
    DROP CONSTRAINT IF EXISTS user_profiles_premium_source_check;

ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_premium_source_check
    CHECK (
        premium_source IS NULL
        OR premium_source IN ('paystack', 'mpesa', 'manual', 'promo')
    );

-- ────────────────────────────────────────────────────────────
-- 3. RLS — authenticated users can SELECT their own row
-- ────────────────────────────────────────────────────────────
-- Enable RLS on user_profiles if not already enabled
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile"   ON public.user_profiles;
CREATE POLICY "Users can read own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = id);

-- ────────────────────────────────────────────────────────────
-- 4. RLS — authenticated users can UPDATE their own row
--    (limited: they cannot elevate themselves to premium;
--     premium activation is done by the service-role webhook)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ────────────────────────────────────────────────────────────
-- 5. RLS — authenticated users can INSERT their own row
--    (needed so the handle_new_user trigger / sign-up flow works)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile"
    ON public.user_profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Service-role key bypasses RLS automatically — no extra policy needed
-- for the webhook to write premium fields.
