-- =============================================================
-- Migration: 001_initial_schema.sql
-- Project:   salarycalculator.co.ke  (Supabase: wznopthjoaqusalqoyru)
-- Purpose:   Bootstrap tables that later migrations depend on.
--            Safe to re-run — all statements use IF NOT EXISTS.
-- =============================================================

-- ---------------------------------------------------------------
-- 1. user_profiles
--    Core user record linked to auth.users.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email           TEXT,
    full_name       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Premium / subscription fields
    is_premium      BOOLEAN NOT NULL DEFAULT FALSE,
    premium_source  TEXT CHECK (
                        premium_source IN (
                            'paystack', 'manual', 'easter_gift_2026', 'admin'
                        )
                    ),
    premium_expires_at TIMESTAMPTZ,
    p9a_access      BOOLEAN NOT NULL DEFAULT FALSE,
    payroll_access  BOOLEAN NOT NULL DEFAULT FALSE,
    admin_note      TEXT,

    -- Newsletter opt-in
    newsletter_subscribed BOOLEAN NOT NULL DEFAULT FALSE,

    -- Soft-delete / admin flag
    is_admin        BOOLEAN NOT NULL DEFAULT FALSE,
    is_banned       BOOLEAN NOT NULL DEFAULT FALSE
);

-- Keep updated_at current automatically
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------
-- 2. Row-Level Security
-- ---------------------------------------------------------------
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read and update their own row
DROP POLICY IF EXISTS "users_own_profile_select" ON public.user_profiles;
CREATE POLICY "users_own_profile_select"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_own_profile_update" ON public.user_profiles;
CREATE POLICY "users_own_profile_update"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid() = id);

-- Service-role bypass (Edge Functions use service role)
DROP POLICY IF EXISTS "service_role_full_access" ON public.user_profiles;
CREATE POLICY "service_role_full_access"
    ON public.user_profiles FOR ALL
    USING (auth.role() = 'service_role');

-- ---------------------------------------------------------------
-- 3. Auto-create profile on new user sign-up
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------
-- 4. newsletter_subscribers  (standalone table for non-auth subs)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT NOT NULL UNIQUE,
    subscribed  BOOLEAN NOT NULL DEFAULT TRUE,
    source      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "newsletter_service_role_only" ON public.newsletter_subscribers;
CREATE POLICY "newsletter_service_role_only"
    ON public.newsletter_subscribers FOR ALL
    USING (auth.role() = 'service_role');

-- ---------------------------------------------------------------
-- 5. paystack_payments   (payment audit log)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.paystack_payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reference       TEXT UNIQUE NOT NULL,
    amount_kobo     BIGINT NOT NULL,         -- amount in kobo (KES × 100)
    currency        TEXT NOT NULL DEFAULT 'KES',
    plan_code       TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',  -- pending | success | failed
    payload         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.paystack_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_service_role_only" ON public.paystack_payments;
CREATE POLICY "payments_service_role_only"
    ON public.paystack_payments FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "users_own_payments_select" ON public.paystack_payments;
CREATE POLICY "users_own_payments_select"
    ON public.paystack_payments FOR SELECT
    USING (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- Done. Migrations 004+ can now safely ALTER public.user_profiles.
-- ---------------------------------------------------------------
