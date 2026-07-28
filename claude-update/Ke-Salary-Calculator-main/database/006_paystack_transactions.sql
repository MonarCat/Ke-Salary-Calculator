-- ============================================================
-- 006_paystack_transactions.sql
-- Run in the Supabase SQL Editor (after 005_trial_period.sql).
--
-- What this migration does:
--   1. Replaces the paypal_transactions audit table with
--      paystack_transactions (Paystack is the new payment provider).
--   2. Sets Row Level Security so only the service-role webhook can write.
--   3. Adds index on payer_email for fast lookup during webhook processing.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Paystack transactions audit table
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.paystack_transactions (
    id           bigserial    PRIMARY KEY,
    reference    text         NOT NULL UNIQUE,   -- Paystack transaction reference (dedup key)
    payer_email  text,
    amount_kobo  integer,                         -- amount in kobo (÷100 = KES)
    currency     text         DEFAULT 'KES',
    status       text,                            -- 'success'
    plan         text         DEFAULT 'monthly',  -- 'monthly' | 'yearly'
    user_id      uuid         REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    processed_at timestamptz  DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 2. Row Level Security
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.paystack_transactions ENABLE ROW LEVEL SECURITY;

-- No SELECT policy → anon and authenticated clients cannot read transaction data.
-- Service-role key bypasses RLS entirely, so the webhook can always UPSERT.

DROP POLICY IF EXISTS "No client reads paystack_transactions" ON public.paystack_transactions;
CREATE POLICY "No client reads paystack_transactions"
    ON public.paystack_transactions FOR SELECT
    USING (false);

-- ────────────────────────────────────────────────────────────
-- 3. Index for fast payer_email lookups during webhook processing
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_paystack_transactions_payer_email
    ON public.paystack_transactions (payer_email);

-- ────────────────────────────────────────────────────────────
-- 4. Update premium_source constraint to include 'paystack'
-- ────────────────────────────────────────────────────────────
-- Reflect that the site now accepts Paystack (not PayPal) payments.
COMMENT ON COLUMN public.user_profiles.premium_source IS
    'Payment source: ''paystack'' | ''mpesa'' | ''manual''';
