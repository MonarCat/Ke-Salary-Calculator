-- Admin dashboard overhaul support objects

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS p9a_access BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payroll_access BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS calculation_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payslip_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_note TEXT,
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_premium_source_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_premium_source_check
  CHECK (premium_source IS NULL OR premium_source IN (
    'paystack', 'mpesa', 'airtel', 'admin', 'easter_gift_2026', 'manual'
  ));

CREATE INDEX IF NOT EXISTS idx_up_email ON public.user_profiles (email);
CREATE INDEX IF NOT EXISTS idx_up_premium ON public.user_profiles (premium_expires_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_up_created ON public.user_profiles (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_up_active ON public.user_profiles (last_active_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_email TEXT,
  target_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE VIEW public.admin_analytics AS
SELECT
  COUNT(*) AS total_users,
  COUNT(*) FILTER (WHERE premium_expires_at > now()) AS premium_users,
  COUNT(*) FILTER (
    WHERE premium_expires_at IS NULL OR premium_expires_at <= now()
  ) AS free_users,
  COUNT(*) FILTER (
    WHERE premium_expires_at IS NOT NULL AND premium_expires_at <= now()
  ) AS expired_users,
  COUNT(*) FILTER (WHERE created_at > now() - INTERVAL '7 days') AS new_this_week,
  COUNT(*) FILTER (WHERE created_at > now() - INTERVAL '30 days') AS new_this_month,
  COALESCE(SUM(calculation_count), 0) AS total_calculations,
  COALESCE(SUM(payslip_count), 0) AS total_payslips,
  COUNT(*) FILTER (WHERE last_active_at > now() - INTERVAL '7 days') AS active_this_week
FROM public.user_profiles;

CREATE OR REPLACE VIEW public.admin_growth_daily AS
SELECT
  DATE_TRUNC('day', created_at)::DATE AS day,
  COUNT(*) AS signups,
  COUNT(*) FILTER (WHERE premium_expires_at > now()) AS premium_signups
FROM public.user_profiles
WHERE created_at > now() - INTERVAL '90 days'
GROUP BY 1
ORDER BY 1;

GRANT SELECT ON public.admin_analytics TO authenticated;
GRANT SELECT ON public.admin_growth_daily TO authenticated;
