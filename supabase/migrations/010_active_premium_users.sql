-- /supabase/migrations/010_active_premium_users.sql
--
-- Root-cause fix: active_premium_users was an empty table because the payment
-- handlers (paystack-webhook.js, paystack-verify.js) write only to user_profiles.
-- Nothing ever populated the separate table.
--
-- Solution: replace the empty table with a VIEW over user_profiles.
-- The view is always current — no trigger or manual sync required.
-- Any user whose premium flag is set in user_profiles (by either API handler)
-- will appear here automatically; expired entries disappear at expiry time.
--
-- Run once in Supabase SQL Editor or via `supabase db push`.

-- ── 1. Add premium_activated_at column to user_profiles ───────────────────────
--    Tracks the exact moment premium was activated (not the generic updated_at).
--    Back-filled to now() for existing premium users as a best-effort estimate.

ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS premium_activated_at timestamptz;

UPDATE public.user_profiles
SET    premium_activated_at = now()
WHERE  premium = true
  AND  premium_activated_at IS NULL;

-- ── 2. Drop the previously empty table (if it exists) ─────────────────────────
--    This is safe: the table had no data (that was the reported bug).

DROP TABLE IF EXISTS public.active_premium_users;

-- ── 3. Create the view ─────────────────────────────────────────────────────────
--    Joins user_profiles (premium status) with auth.users (email) so each row
--    is fully identifiable.  Runs as the view owner (postgres) which has
--    permission to read auth.users.

CREATE OR REPLACE VIEW public.active_premium_users AS
SELECT
    up.id                    AS user_id,
    au.email,
    up.premium_source,
    up.premium_expires_at,
    up.premium_activated_at,
    up.account_type
FROM  public.user_profiles up
JOIN  auth.users           au ON au.id = up.id
WHERE up.premium = true
  AND (up.premium_expires_at IS NULL OR up.premium_expires_at > now());

-- ── 4. Grant read access ───────────────────────────────────────────────────────
--    service_role is used by API routes and the Supabase admin dashboard.
--    Authenticated users check their own status via user_profiles (with RLS),
--    not through this admin view.

GRANT SELECT ON public.active_premium_users TO service_role;

-- ── Verify (run manually after applying) ──────────────────────────────────────
-- SELECT * FROM public.active_premium_users;
