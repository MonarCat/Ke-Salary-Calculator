-- /supabase/migrations/016_admin_user_profiles.sql
--
-- Adds columns required by the admin-ops Edge Function and the SC Admin Dashboard.
-- Run in: Supabase → SQL Editor

-- ── New columns ──────────────────────────────────────────────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS p9a_access         BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS payroll_access     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_note         TEXT,
  ADD COLUMN IF NOT EXISTS calculation_count  INT DEFAULT 0;

-- ── premium_source CHECK constraint ─────────────────────────────────────────
-- Drop the old constraint (migration 015 already expanded it, but we re-apply
-- to be idempotent and to ensure 'admin' is included).
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

-- ── Indexes for admin dashboard queries ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_profiles_email
  ON public.user_profiles (email);

CREATE INDEX IF NOT EXISTS idx_user_profiles_premium
  ON public.user_profiles (premium_expires_at);
