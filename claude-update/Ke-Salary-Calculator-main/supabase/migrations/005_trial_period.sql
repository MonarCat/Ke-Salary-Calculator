-- Migration 005: Trial period columns for organisation / employer accounts
-- Run after 004_premium_and_newsletter.sql

-- ── Add trial columns to user_profiles ───────────────────────────────────────

ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS trial_activated_at timestamptz,
    ADD COLUMN IF NOT EXISTS trial_expires_at   timestamptz;

-- ── Trigger: auto-activate trial on org/employer signup ──────────────────────

CREATE OR REPLACE FUNCTION public.handle_org_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only activate for organisation / employer account types
    -- Supports both British ('organisation') and American ('organization') spellings,
    -- matching the frontend check in premium.js and the account_type values in the DB.
    IF lower(NEW.account_type) IN ('employer', 'organisation', 'organization') THEN
        -- Only set trial dates if not already set
        IF NEW.trial_activated_at IS NULL THEN
            NEW.trial_activated_at := now();
            NEW.trial_expires_at   := now() + interval '30 days';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_org_trial ON public.user_profiles;

CREATE TRIGGER trg_org_trial
    BEFORE INSERT OR UPDATE OF account_type
    ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_org_trial();

-- ── Helper function: is_on_trial ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_on_trial(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT
        COALESCE(
            (p.trial_activated_at IS NOT NULL AND now() < p.trial_expires_at),
            false
        )
    FROM public.user_profiles p
    WHERE p.id = p_user_id
    LIMIT 1;
$$;
