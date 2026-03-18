-- /supabase/migrations/009_reset_free_org_premium.sql
--
-- Resets premium = false for users who received it via a free org upgrade
-- (no real payment was ever made).  Only accounts with premium_source IN
-- ('paystack', 'mpesa', 'airtel') are treated as genuinely paid.
--
-- After this migration:
--   • Free-upgraded org accounts keep account_type = 'employer' so their
--     data is preserved, but premium = false, so they see the Free Plan in
--     the UI and hit the gate when accessing paid features.
--   • Paystack / M-Pesa / Airtel paying users are untouched.
--
-- Safe to run multiple times (idempotent UPDATE).

UPDATE public.user_profiles
SET
    premium            = false,
    premium_expires_at = NULL
WHERE
    premium = true
    AND (
        premium_source IS NULL
        OR premium_source NOT IN ('paystack', 'mpesa', 'airtel')
    );

-- ── Also drop the old trigger that auto-started trials on org signup ─────────
-- (migration 008 already nullified existing trial data; this ensures no new
-- trials are started if the trigger still exists in some environments.)

DROP TRIGGER IF EXISTS trg_org_trial ON public.user_profiles;

-- ── Confirm: show affected rows after manual run ─────────────────────────────
-- SELECT count(*) FROM public.user_profiles WHERE premium = true AND premium_source IN ('paystack','mpesa','airtel');
