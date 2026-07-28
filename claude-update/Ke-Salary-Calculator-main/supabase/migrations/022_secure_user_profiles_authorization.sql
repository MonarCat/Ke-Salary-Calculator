-- Lock down user_profiles so authenticated clients cannot write authorization,
-- billing, or access-control fields through PostgREST.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS account_type TEXT,
  ADD COLUMN IF NOT EXISTS organization_name TEXT;

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Remove every historical direct write policy. Service-role clients bypass RLS,
-- while signed-in users use the narrowly scoped RPCs below.
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_profiles'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_profiles', policy_record.policyname);
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS "user_profiles_select_own" ON public.user_profiles;
DROP POLICY IF EXISTS "users_own_profile_select" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;

CREATE POLICY "user_profiles_select_own"
  ON public.user_profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);

REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_profiles FROM anon, authenticated;
GRANT SELECT ON TABLE public.user_profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_full_name TEXT DEFAULT NULL,
  p_newsletter_subscribed BOOLEAN DEFAULT NULL,
  p_organization_name TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_full_name TEXT;
  v_organization_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_full_name IS NOT NULL THEN
    v_full_name := btrim(p_full_name);
    IF char_length(v_full_name) NOT BETWEEN 1 AND 120 THEN
      RAISE EXCEPTION 'Full name must contain between 1 and 120 characters';
    END IF;
  END IF;

  IF p_organization_name IS NOT NULL THEN
    v_organization_name := btrim(p_organization_name);
    IF char_length(v_organization_name) NOT BETWEEN 1 AND 160 THEN
      RAISE EXCEPTION 'Organization name must contain between 1 and 160 characters';
    END IF;
  END IF;

  UPDATE public.user_profiles
  SET full_name = COALESCE(v_full_name, full_name),
      newsletter_subscribed = COALESCE(p_newsletter_subscribed, newsletter_subscribed),
      newsletter = COALESCE(p_newsletter_subscribed, newsletter),
      organization_name = COALESCE(v_organization_name, organization_name)
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.upgrade_my_account_to_employer(
  p_organization_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_organization_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_organization_name := btrim(p_organization_name);
  IF char_length(v_organization_name) NOT BETWEEN 1 AND 160 THEN
    RAISE EXCEPTION 'Organization name must contain between 1 and 160 characters';
  END IF;

  UPDATE public.user_profiles
  SET account_type = 'employer',
      organization_name = v_organization_name
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_profile(TEXT, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upgrade_my_account_to_employer(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_profile(TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upgrade_my_account_to_employer(TEXT) TO authenticated;

-- Legacy definer helpers touching user_profiles must not be callable by anon or
-- ordinary authenticated clients. Service-role API routes retain administrative
-- access, and trigger execution does not depend on EXECUTE grants.
ALTER FUNCTION IF EXISTS public.handle_new_user() SET search_path = '';
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

ALTER FUNCTION IF EXISTS public.grant_premium(TEXT, TEXT, INTEGER) SET search_path = '';
REVOKE ALL ON FUNCTION public.grant_premium(TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_premium(TEXT, TEXT, INTEGER) TO service_role;

ALTER FUNCTION IF EXISTS public.get_user_id_by_email(TEXT) SET search_path = '';
REVOKE ALL ON FUNCTION public.get_user_id_by_email(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) TO service_role;

ALTER FUNCTION IF EXISTS public.activate_trial_by_email(TEXT) SET search_path = '';
REVOKE ALL ON FUNCTION public.activate_trial_by_email(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_trial_by_email(TEXT) TO service_role;

DO $$
BEGIN
  IF to_regprocedure('public.handle_org_trial()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.handle_org_trial() SET search_path = ''''';
    EXECUTE 'REVOKE ALL ON FUNCTION public.handle_org_trial() FROM PUBLIC';
  END IF;
END;
$$;

ALTER FUNCTION IF EXISTS public.is_on_trial(UUID) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.is_on_trial(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_on_trial(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_premium_access(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT p.premium = TRUE
       AND (p.premium_expires_at IS NULL OR p.premium_expires_at > now())
    FROM public.user_profiles AS p
    WHERE p.id = p_user_id
      AND (p_user_id = auth.uid() OR auth.role() = 'service_role')
  ), FALSE);
$$;

REVOKE ALL ON FUNCTION public.has_premium_access(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_premium_access(UUID) TO authenticated, service_role;
