-- Migration 006: Paystack transactions table
-- Run after 005_trial_period.sql

-- ── paystack_transactions ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.paystack_transactions (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    reference    text        UNIQUE NOT NULL,
    payer_email  text        NOT NULL,
    amount_kobo  bigint,
    currency     text        DEFAULT 'KES',
    status       text        DEFAULT 'success',
    plan         text        DEFAULT 'monthly',   -- 'monthly' | 'yearly'
    user_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at   timestamptz DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_paystack_transactions_reference
    ON public.paystack_transactions (reference);

CREATE INDEX IF NOT EXISTS idx_paystack_transactions_user_id
    ON public.paystack_transactions (user_id);

CREATE INDEX IF NOT EXISTS idx_paystack_transactions_payer_email
    ON public.paystack_transactions (payer_email);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.paystack_transactions ENABLE ROW LEVEL SECURITY;

-- Service role (used by API routes) bypasses RLS automatically.
-- Users can view their own transactions.
CREATE POLICY IF NOT EXISTS "paystack_transactions_select_own"
    ON public.paystack_transactions
    FOR SELECT
    USING (auth.uid() = user_id);
