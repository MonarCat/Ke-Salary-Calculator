-- ============================================================
-- 007_fix_trial_period.sql
-- Run in the Supabase SQL Editor (after 006_paystack_transactions.sql).
--
-- What this migration does:
--   Updates is_on_trial() to use the per-user trial_activated_at /
--   trial_expires_at columns instead of the previously hardcoded
--   global trial window.  The billing section in profile.html now
--   writes these columns when a user upgrades their account, so
--   every user gets their own 30-day window starting from their
--   personal upgrade date.
-- ============================================================

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
                AND trial_activated_at IS NOT NULL
                AND trial_expires_at   IS NOT NULL
                AND now() BETWEEN trial_activated_at AND trial_expires_at
            FROM public.user_profiles
            WHERE id = p_user_id
        ),
        false
    );
$$;

-- Grant unchanged — authenticated users may still call the function
-- to check their own status.
GRANT EXECUTE ON FUNCTION public.is_on_trial(uuid) TO authenticated;
