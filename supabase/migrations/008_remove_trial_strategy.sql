-- /supabase/migrations/008_remove_trial_strategy.sql
--
-- Removes all trial-period enforcement.
-- is_on_trial() now always returns false.
-- has_premium_access() checks only the paid premium flag.
--
-- Safe to run multiple times (OR REPLACE).

-- ── 1. is_on_trial — always false ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_on_trial(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT false;
$$;

-- ── 2. has_premium_access — paid-only, no trial logic ────────────────────────
CREATE OR REPLACE FUNCTION public.has_premium_access(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT
        premium = true
        AND (premium_expires_at IS NULL OR premium_expires_at > now())
      FROM public.user_profiles
      WHERE id = p_user_id
    ),
    false
  );
$$;

-- ── 3. Nullify any existing trial columns so they do not grant access ─────────
UPDATE public.user_profiles
SET
  trial_activated_at = NULL,
  trial_expires_at   = NULL
WHERE
  trial_activated_at IS NOT NULL
  OR trial_expires_at IS NOT NULL;
