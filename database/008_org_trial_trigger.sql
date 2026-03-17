-- ============================================================
-- 008_org_trial_trigger.sql
-- Run in the Supabase SQL Editor (after 007_fix_trial_period.sql).
--
-- What this migration does:
--   1. Adds a BEFORE INSERT OR UPDATE OF account_type trigger on
--      user_profiles that automatically sets trial_activated_at and
--      trial_expires_at whenever a row is created or updated with
--      account_type = 'employer' | 'organisation' | 'organization'.
--      This means new org signups get their trial activated immediately
--      without any manual step.
--   2. Creates the activate_trial_by_email(p_email text) admin helper
--      function for manually activating/re-activating a trial by email.
--      Useful for fixing accounts where trial_activated_at is NULL.
--
-- Safe to re-run (idempotent).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Trigger function: auto-set trial dates on org accounts
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auto_activate_org_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only activate if the account_type is an org tier
    IF NEW.account_type IN ('employer', 'organisation', 'organization') THEN
        -- Set trial_activated_at if not already set
        IF NEW.trial_activated_at IS NULL THEN
            NEW.trial_activated_at := now();
            NEW.trial_expires_at   := now() + interval '30 days';
        -- Also repair trial_expires_at if it is somehow missing
        ELSIF NEW.trial_expires_at IS NULL THEN
            NEW.trial_expires_at := NEW.trial_activated_at + interval '30 days';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- Attach the trigger (drop first so it is idempotent)
DROP TRIGGER IF EXISTS trg_auto_activate_org_trial ON public.user_profiles;

CREATE TRIGGER trg_auto_activate_org_trial
    BEFORE INSERT OR UPDATE OF account_type
    ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_activate_org_trial();

-- ────────────────────────────────────────────────────────────
-- 2. activate_trial_by_email(p_email text) → text
--    Admin helper: look up user by email via auth.users,
--    then force-set trial_activated_at / trial_expires_at.
--    Returns a status message.
--
--    Usage (Supabase SQL editor):
--      SELECT public.activate_trial_by_email('user@example.com');
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.activate_trial_by_email(p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
    v_user_id uuid;
    v_now     timestamptz := now();
BEGIN
    -- Look up in auth.users (user_profiles has no email column)
    SELECT id
    INTO   v_user_id
    FROM   auth.users
    WHERE  email = lower(trim(p_email))
    LIMIT  1;

    IF v_user_id IS NULL THEN
        RETURN 'ERROR: no user found with email ' || p_email;
    END IF;

    -- Upsert trial dates on the profile row
    UPDATE public.user_profiles
    SET    trial_activated_at = v_now,
           trial_expires_at   = v_now + interval '30 days'
    WHERE  id = v_user_id;

    IF NOT FOUND THEN
        RETURN 'ERROR: user_profiles row not found for id ' || v_user_id::text;
    END IF;

    RETURN 'OK: trial activated for ' || p_email
        || ' — expires ' || (v_now + interval '30 days')::date::text;
END;
$$;

-- Only service-role / admin should be able to call this function.
-- Do NOT grant to authenticated or anon.
REVOKE EXECUTE ON FUNCTION public.activate_trial_by_email(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.activate_trial_by_email(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.activate_trial_by_email(text) FROM anon;

-- Grant execute to the auto_activate_org_trial trigger function owner
-- (service-role bypasses RLS and can always call this directly).
COMMENT ON FUNCTION public.activate_trial_by_email(text) IS
    'Admin-only helper: manually activate a 30-day trial for an org/employer account. '
    'Callable from the Supabase SQL Editor with the service-role key. '
    'Returns a status message.';
