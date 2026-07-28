-- ============================================================
-- 005_trial_period.sql
-- Run in the Supabase SQL Editor (after 004_premium_and_newsletter.sql).
--
-- What this migration does:
--   1. Adds trial_activated_at and trial_expires_at columns to user_profiles
--   2. Creates the is_on_trial() and has_premium_access() helper functions
--   3. Adds account_type column if not already present
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Trial columns on user_profiles
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS account_type        text        DEFAULT 'individual',
    ADD COLUMN IF NOT EXISTS trial_activated_at  timestamptz,
    ADD COLUMN IF NOT EXISTS trial_expires_at    timestamptz;

-- ────────────────────────────────────────────────────────────
-- 2a. is_on_trial(p_user_id uuid) → boolean
--     Returns true if the user is an organisation/employer
--     currently within the trial window.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_on_trial(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (
            SELECT
                account_type IN ('employer', 'organisation', 'organization')
                AND now() >= '2026-03-15T00:00:00Z'::timestamptz
                AND now() <= '2026-04-14T23:59:59Z'::timestamptz
            FROM public.user_profiles
            WHERE id = p_user_id
        ),
        false
    );
$$;

-- ────────────────────────────────────────────────────────────
-- 2b. has_premium_access(p_user_id uuid) → boolean
--     Returns true if paid premium is active OR trial is active.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_premium_access(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        public.check_premium_active(p_user_id)
        OR public.is_on_trial(p_user_id);
$$;

-- ────────────────────────────────────────────────────────────
-- 3. Helper: get_user_id_by_email(p_email text) → uuid
--    Looks up a user in auth.users (not user_profiles, which has no email).
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
    SELECT id FROM auth.users WHERE email = lower(trim(p_email)) LIMIT 1;
$$;

-- Grant execute to authenticated users for own-data checks
GRANT EXECUTE ON FUNCTION public.is_on_trial(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_premium_access(uuid)  TO authenticated;
-- get_user_id_by_email must only be called server-side; do NOT grant to authenticated.
