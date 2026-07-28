-- ============================================================
-- 025_donations.sql
-- Run in the Supabase SQL Editor (after 024_secure_paystack_payment_processing.sql).
--
-- What this migration does:
--   1. Adds a `donations` audit table for one-off Paystack donations
--      made from /donate.html. This is intentionally separate from
--      `payment_intents` / `paystack_transactions`, which are reserved
--      for the authenticated Premium subscription flow — donations are
--      anonymous, unauthenticated, and never grant premium access.
--   2. Sets Row Level Security so only the service-role API route
--      (api/paystack-donation-verify.js) can write, mirroring the
--      pattern used for paystack_transactions in 006.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Donations audit table
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.donations (
    id                      bigserial    PRIMARY KEY,
    reference               text         NOT NULL UNIQUE,  -- Paystack reference, e.g. SC-DONATE-...
    paystack_transaction_id bigint,
    amount_kobo             integer      NOT NULL CHECK (amount_kobo > 0),
    currency                text         NOT NULL DEFAULT 'KES',
    donor_name              text,
    donor_email             text,
    status                  text         NOT NULL DEFAULT 'success',
    created_at              timestamptz  NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 2. Row Level Security
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT policy for anon or authenticated roles → the service-role
-- key (used only inside api/paystack-donation-verify.js) bypasses RLS and is
-- the sole writer. Donors are never authenticated, so this table has no
-- per-user ownership model — just an append-only log for reconciliation.
DROP POLICY IF EXISTS "No client access to donations" ON public.donations;
CREATE POLICY "No client access to donations"
    ON public.donations FOR ALL
    USING (false)
    WITH CHECK (false);

-- ────────────────────────────────────────────────────────────
-- 3. Index for reconciliation lookups
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_donations_created_at
    ON public.donations (created_at DESC);
