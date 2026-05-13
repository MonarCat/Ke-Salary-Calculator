-- Repair admin analytics objects for projects that applied the admin dashboard
-- SQL out of order or before the latest user_profiles columns existed.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS calculation_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payslip_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

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
  COUNT(*) FILTER (
    WHERE premium_expires_at IS NOT NULL AND premium_expires_at > created_at
  ) AS premium_signups
FROM public.user_profiles
WHERE created_at > now() - INTERVAL '90 days'
GROUP BY 1
ORDER BY 1;

GRANT SELECT ON public.admin_analytics TO anon, authenticated, service_role;
GRANT SELECT ON public.admin_growth_daily TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
