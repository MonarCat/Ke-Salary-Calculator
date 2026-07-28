-- Repair admin dashboard schema dependencies that may be missing on older projects.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS p9a_access BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payroll_access BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS calculation_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payslip_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_note TEXT,
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at_desc
  ON public.user_profiles (created_at DESC);

NOTIFY pgrst, 'reload schema';
