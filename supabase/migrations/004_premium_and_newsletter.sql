-- Migration 004: Premium access and newsletter subscription columns
-- Run this in Supabase SQL Editor or via supabase db push

-- ── user_profiles ────────────────────────────────────────────────────────────

-- Add premium columns if they don't already exist
ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS premium            boolean     NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS premium_expires_at timestamptz,
    ADD COLUMN IF NOT EXISTS premium_source     text,
    ADD COLUMN IF NOT EXISTS newsletter         boolean     NOT NULL DEFAULT false;

-- premium_source allowed values: 'paystack' | 'mpesa' | 'airtel' | 'admin' | 'paypal'

-- ── RLS policies ──────────────────────────────────────────────────────────────

-- Users can read their own profile
CREATE POLICY IF NOT EXISTS "user_profiles_select_own"
    ON public.user_profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile (limited columns via app logic)
CREATE POLICY IF NOT EXISTS "user_profiles_update_own"
    ON public.user_profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- ── Helper function: has_premium_access ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.has_premium_access(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT
        COALESCE(
            -- Paid premium: flag is true AND either no expiry or expiry is in the future
            (p.premium AND (p.premium_expires_at IS NULL OR p.premium_expires_at > now()))
            OR
            -- Active trial: activated and not yet expired
            (p.trial_activated_at IS NOT NULL AND now() < p.trial_expires_at),
            false
        )
    FROM public.user_profiles p
    WHERE p.id = p_user_id
    LIMIT 1;
$$;

-- ── Helper function: grant_premium ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.grant_premium(
    p_email   text,
    p_source  text  DEFAULT 'admin',
    p_months  int   DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    -- Look up via auth.users (user_profiles has no email column)
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE lower(email) = lower(p_email)
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No user found with email %', p_email;
    END IF;

    UPDATE public.user_profiles
    SET
        premium            = true,
        premium_expires_at = now() + (p_months || ' months')::interval,
        premium_source     = p_source
    WHERE id = v_user_id;
END;
$$;

-- ── Helper function: get_user_id_by_email ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$;
