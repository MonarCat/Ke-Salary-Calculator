-- ============================================================
-- 004_premium_and_newsletter.sql
-- Run in the Supabase SQL Editor (after the earlier migrations).
--
-- What this migration does:
--   1. Adds premium columns to user_profiles
--   2. Creates the paypal_transactions audit table
--   3. Creates/updates the newsletter_subscribers table
--   4. Adds SQL helper functions: check_premium_active() and grant_premium()
--   5. Sets up Row Level Security policies for all new tables/columns
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Premium columns on user_profiles
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS premium             boolean     NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS premium_expires_at  timestamptz,
    ADD COLUMN IF NOT EXISTS premium_source      text;       -- 'paypal' | 'mpesa' | 'manual'

-- ────────────────────────────────────────────────────────────
-- 2. PayPal transactions audit table (one row per IPN event)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.paypal_transactions (
    id             bigserial   PRIMARY KEY,
    txn_id         text        NOT NULL UNIQUE,  -- PayPal transaction ID (dedup key)
    txn_type       text,
    payment_status text,
    payer_email    text,
    gross_amount   numeric(12, 2),
    currency       text        DEFAULT 'USD',
    custom_field   text,                          -- caller-supplied user_id / metadata
    item_name      text,
    raw_ipn        text,
    processed_at   timestamptz DEFAULT now()
);

-- Only the service role (webhook) should write; no client-side reads
ALTER TABLE public.paypal_transactions ENABLE ROW LEVEL SECURITY;

-- No SELECT policy → clients (even authenticated) cannot read transaction data
-- Service-role key bypasses RLS entirely, so the webhook can always INSERT.

DROP POLICY IF EXISTS "No client reads paypal_transactions" ON public.paypal_transactions;
CREATE POLICY "No client reads paypal_transactions"
    ON public.paypal_transactions FOR SELECT
    USING (false);

-- ────────────────────────────────────────────────────────────
-- 3. Newsletter subscribers (idempotent re-creation)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
    id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    email         text        NOT NULL UNIQUE,
    subscribed_at timestamptz DEFAULT now(),
    source        text        DEFAULT 'website'  -- e.g. 'calculator', 'index', 'blog'
);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can subscribe"                     ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Anyone can upsert their own subscription" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "No client-side reads of subscriber list"  ON public.newsletter_subscribers;

CREATE POLICY "Anyone can subscribe"
    ON public.newsletter_subscribers FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Anyone can upsert their own subscription"
    ON public.newsletter_subscribers FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "No client-side reads of subscriber list"
    ON public.newsletter_subscribers FOR SELECT
    USING (false);

-- ────────────────────────────────────────────────────────────
-- 4a. check_premium_active(p_user_id uuid) → boolean
--     Returns true if the user's premium is active (not expired).
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_premium_active(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (
            SELECT premium AND (premium_expires_at IS NULL OR premium_expires_at > now())
            FROM public.user_profiles
            WHERE id = p_user_id
        ),
        false
    );
$$;

-- ────────────────────────────────────────────────────────────
-- 4b. grant_premium(p_user_id, p_source, p_duration_days, p_txn_id)
--     Activates premium for a user, extending any existing expiry.
--     Called by the PayPal webhook; can also be called manually from
--     the Supabase dashboard to activate M-Pesa / manual payments.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.grant_premium(
    p_user_id      uuid,
    p_source       text    DEFAULT 'manual',
    p_duration_days integer DEFAULT 30,
    p_txn_id       text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_expiry timestamptz;
    v_new_expiry     timestamptz;
BEGIN
    -- Fetch current expiry (may be NULL if never set or already expired)
    SELECT premium_expires_at
    INTO   v_current_expiry
    FROM   public.user_profiles
    WHERE  id = p_user_id;

    -- Extend from today or from the existing future expiry, whichever is later
    v_new_expiry := GREATEST(now(), COALESCE(v_current_expiry, now()))
                    + make_interval(days => p_duration_days);

    UPDATE public.user_profiles
    SET    premium            = true,
           premium_expires_at = v_new_expiry,
           premium_source     = p_source,
           updated_at         = now()
    WHERE  id = p_user_id;

    -- Optionally record the grant in the transactions table if a txn_id is given
    IF p_txn_id IS NOT NULL THEN
        UPDATE public.paypal_transactions
        SET    payment_status = 'Completed'
        WHERE  txn_id = p_txn_id;
    END IF;
END;
$$;

-- Grant execute to authenticated users so they can call check_premium_active() on themselves
GRANT EXECUTE ON FUNCTION public.check_premium_active(uuid) TO authenticated;
-- grant_premium must only be called server-side (service role); do NOT grant to authenticated.
