-- Admin User Management SQL
-- Run this in your Supabase SQL Editor AFTER admin-setup.sql and employers-setup.sql

-- 1. Allow admins to view all employer records
DROP POLICY IF EXISTS "Admins can view all employers" ON employers;
CREATE POLICY "Admins can view all employers" ON employers
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

-- 2. Function to get all registered users (admin only)
--    Queries auth.users via SECURITY DEFINER to bypass row-level restrictions.
CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS TABLE(
  id               UUID,
  email            TEXT,
  display_name     TEXT,
  created_at       TIMESTAMPTZ,
  last_sign_in_at  TIMESTAMPTZ,
  is_admin_user    BOOLEAN,
  is_super_admin   BOOLEAN
) AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email,
    COALESCE(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      split_part(u.email, '@', 1)
    ) AS display_name,
    u.created_at,
    u.last_sign_in_at,
    EXISTS(
      SELECT 1 FROM public.admin_users au WHERE au.user_id = u.id
    ) AS is_admin_user,
    COALESCE(
      (SELECT au.is_super_admin FROM public.admin_users au WHERE au.user_id = u.id),
      FALSE
    ) AS is_super_admin
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

GRANT EXECUTE ON FUNCTION public.get_all_users TO authenticated;

-- 3. Function to get all organisations / employer profiles (admin only)
CREATE OR REPLACE FUNCTION public.get_all_employers()
RETURNS TABLE(
  id                   UUID,
  user_id              UUID,
  email                TEXT,
  organization_name    TEXT,
  business_type        TEXT,
  industry             TEXT,
  county               TEXT,
  contact_email        TEXT,
  contact_phone        TEXT,
  employee_limit       INTEGER,
  created_at           TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.user_id,
    u.email,
    e.organization_name,
    e.business_type,
    e.industry,
    e.county,
    e.contact_email,
    e.contact_phone,
    e.employee_limit,
    e.created_at
  FROM public.employers e
  LEFT JOIN auth.users u ON u.id = e.user_id
  ORDER BY e.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

GRANT EXECUTE ON FUNCTION public.get_all_employers TO authenticated;

-- 4. Extend get_blog_stats to also return user and organisation counts
CREATE OR REPLACE FUNCTION public.get_blog_stats()
RETURNS TABLE(
  total_posts          BIGINT,
  total_comments       BIGINT,
  total_reactions      BIGINT,
  total_views          BIGINT,
  posts_this_month     BIGINT,
  comments_this_month  BIGINT,
  total_users          BIGINT,
  total_organizations  BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.blog_posts WHERE status = 'published')              AS total_posts,
    (SELECT COUNT(*) FROM public.post_comments WHERE is_approved = TRUE)             AS total_comments,
    (SELECT COUNT(*) FROM public.post_reactions)                                     AS total_reactions,
    (SELECT COALESCE(SUM(views_count), 0) FROM public.blog_posts)                   AS total_views,
    (SELECT COUNT(*) FROM public.blog_posts
       WHERE created_at >= date_trunc('month', NOW()))                               AS posts_this_month,
    (SELECT COUNT(*) FROM public.post_comments
       WHERE created_at >= date_trunc('month', NOW()))                               AS comments_this_month,
    (SELECT COUNT(*) FROM auth.users)                                                AS total_users,
    (SELECT COUNT(*) FROM public.employers)                                          AS total_organizations;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Re-grant execute (function is replaced, not new, so existing grants should persist,
-- but it is safe to re-grant)
GRANT EXECUTE ON FUNCTION public.get_blog_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_blog_stats TO anon;
