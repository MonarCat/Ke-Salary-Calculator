-- ============================================================
-- 015_fix_premium_activation.sql
-- Run in the Supabase SQL Editor after earlier premium migrations.
--
-- Purpose:
--   1. Ensure user_profiles has the columns used by Paystack activation.
--   2. Make premium_source accept all values currently used by the app.
--   3. Keep user profile RLS compatible with premium/account status checks.
-- ============================================================

ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS premium_activated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS paystack_reference   TEXT;

UPDATE public.user_profiles
SET    premium_activated_at = COALESCE(premium_activated_at, updated_at, created_at, now())
WHERE  premium = true
  AND  premium_activated_at IS NULL;

ALTER TABLE public.user_profiles
    DROP CONSTRAINT IF EXISTS user_profiles_premium_source_check;

ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_premium_source_check
    CHECK (
        premium_source IS NULL
        OR premium_source IN (
            'paystack',
            'mpesa',
            'airtel',
            'manual',
            'promo',
            'admin',
            'paypal',
            'easter_gift_2026'
        )
    );

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
CREATE POLICY "Users can read own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile"
    ON public.user_profiles FOR INSERT
    WITH CHECK (auth.uid() = id);
