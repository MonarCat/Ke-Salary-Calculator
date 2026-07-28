-- Migration 007: Fix org users who show "Free Plan" due to NULL trial_activated_at
--
-- Root cause: accounts created before the trigger in migration 005 was deployed
-- did not have trial_activated_at / trial_expires_at set automatically.
--
-- This migration:
--   1. Adds the activate_trial_by_email() admin helper function.
--   2. Back-fills trial dates for all existing org/employer accounts that
--      have NULL trial_activated_at (sets trial as if activated right now).
--
-- Run in Supabase SQL Editor or via supabase db push.

-- ── Helper: activate_trial_by_email ──────────────────────────────────────────
-- Admin tool: manually activate (or re-activate) trial for a specific user.
-- Returns a status message.

CREATE OR REPLACE FUNCTION public.activate_trial_by_email(p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id  uuid;
    v_rows_upd int;
BEGIN
    -- Look up via auth.users — user_profiles has no email column
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE lower(email) = lower(p_email)
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RETURN 'ERROR: No user found with email ' || p_email;
    END IF;

    UPDATE public.user_profiles
    SET
        trial_activated_at = COALESCE(trial_activated_at, now()),
        trial_expires_at   = COALESCE(trial_expires_at,   now() + interval '30 days')
    WHERE id = v_user_id
      AND lower(account_type) IN ('employer', 'organisation', 'organization');

    GET DIAGNOSTICS v_rows_upd = ROW_COUNT;

    IF v_rows_upd = 0 THEN
        RETURN 'WARNING: User found but is not an org/employer account (or trial already set)';
    END IF;

    RETURN 'OK: Trial activated for ' || p_email;
END;
$$;

-- ── Back-fill existing org accounts ──────────────────────────────────────────

UPDATE public.user_profiles
SET
    trial_activated_at = now(),
    trial_expires_at   = now() + interval '30 days'
WHERE
    lower(account_type) IN ('employer', 'organisation', 'organization')
    AND trial_activated_at IS NULL;
