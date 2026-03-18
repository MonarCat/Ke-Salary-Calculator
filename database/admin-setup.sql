-- Admin Setup Script for Blog Management
-- This script adds admin role functionality and policies for kesalarycalculator@gmail.com

-- 1. Create admin_users table to track admin users
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email TEXT NOT NULL UNIQUE,
  is_super_admin BOOLEAN DEFAULT FALSE,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on admin_users
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Helper: check whether the currently signed-in user is a super-admin.
-- SECURITY DEFINER with an empty search_path means PostgreSQL evaluates the
-- query *without* applying the RLS policies on admin_users, breaking the
-- infinite-recursion that would otherwise occur when a policy on admin_users
-- itself references admin_users.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_super_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

GRANT EXECUTE ON FUNCTION public.is_super_admin TO authenticated;

-- Policy: Anyone can check if they are admin (needed for UI)
DROP POLICY IF EXISTS "Users can check own admin status" ON admin_users;
CREATE POLICY "Users can check own admin status" ON admin_users
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Super admins can view all admins
-- Uses is_super_admin() (SECURITY DEFINER) to avoid infinite RLS recursion.
DROP POLICY IF EXISTS "Super admins can view all admins" ON admin_users;
CREATE POLICY "Super admins can view all admins" ON admin_users
  FOR SELECT USING (public.is_super_admin());

-- Policy: Super admins can grant admin access
DROP POLICY IF EXISTS "Super admins can grant admin" ON admin_users;
CREATE POLICY "Super admins can grant admin" ON admin_users
  FOR INSERT WITH CHECK (public.is_super_admin());

-- Policy: Super admins can update admin records
DROP POLICY IF EXISTS "Super admins can update admin records" ON admin_users;
CREATE POLICY "Super admins can update admin records" ON admin_users
  FOR UPDATE USING (public.is_super_admin());

-- Policy: Super admins can revoke admin access
DROP POLICY IF EXISTS "Super admins can delete admin records" ON admin_users;
CREATE POLICY "Super admins can delete admin records" ON admin_users
  FOR DELETE USING (public.is_super_admin());

-- 2. Create helper function to check if user is admin
-- SECURITY DEFINER with search_path='' prevents search-path injection.
-- Fully-qualified public.admin_users is required when search_path is empty.
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(check_user_id, auth.uid());
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = v_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Allow authenticated (signed-in) users to call is_admin() via the RPC API.
-- Note: when called via the anon key without an active session, auth.uid()
-- returns NULL and the function returns false. For server-side use requiring
-- elevated privileges, call with the service_role key instead.
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;

-- 2b. Helper function to check super-admin status.
-- SECURITY DEFINER bypasses RLS so this function can safely query admin_users
-- from within admin_users RLS policies without causing infinite recursion.
CREATE OR REPLACE FUNCTION public.is_super_admin(check_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(check_user_id, auth.uid());
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = v_user_id AND is_super_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

GRANT EXECUTE ON FUNCTION public.is_super_admin TO authenticated;

-- 2c. Re-create the admin_users policies that previously caused infinite recursion.
-- The inline "EXISTS (SELECT 1 FROM admin_users ...)" subqueries inside the RLS
-- policies for admin_users trigger recursive RLS evaluation, returning HTTP 500.
-- Replacing them with SECURITY DEFINER helper functions breaks the cycle.
DROP POLICY IF EXISTS "Super admins can view all admins" ON admin_users;
CREATE POLICY "Super admins can view all admins" ON admin_users
  FOR SELECT USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins can grant admin" ON admin_users;
CREATE POLICY "Super admins can grant admin" ON admin_users
  FOR INSERT WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins can update admin records" ON admin_users;
CREATE POLICY "Super admins can update admin records" ON admin_users
  FOR UPDATE USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins can delete admin records" ON admin_users;
CREATE POLICY "Super admins can delete admin records" ON admin_users
  FOR DELETE USING (public.is_super_admin());

-- 3. Update blog_posts policies to allow admin full access
DROP POLICY IF EXISTS "Admins can update any post" ON blog_posts;
CREATE POLICY "Admins can update any post" ON blog_posts
  FOR UPDATE USING (
    public.is_admin() OR auth.uid() = author_id
  );

DROP POLICY IF EXISTS "Admins can delete any post" ON blog_posts;
CREATE POLICY "Admins can delete any post" ON blog_posts
  FOR DELETE USING (
    public.is_admin() OR auth.uid() = author_id
  );

DROP POLICY IF EXISTS "Admins can view all posts" ON blog_posts;
CREATE POLICY "Admins can view all posts" ON blog_posts
  FOR SELECT USING (
    status = 'published' OR public.is_admin() OR auth.uid() = author_id
  );

DROP POLICY IF EXISTS "Admins and authors can create posts" ON blog_posts;
CREATE POLICY "Admins and authors can create posts" ON blog_posts
  FOR INSERT WITH CHECK (
    public.is_admin() OR auth.uid() = author_id
  );

-- 4. Update post_comments policies for admin moderation
DROP POLICY IF EXISTS "Admins can view all comments" ON post_comments;
CREATE POLICY "Admins can view all comments" ON post_comments
  FOR SELECT USING (
    is_approved = TRUE OR public.is_admin() OR auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Admins can moderate comments" ON post_comments;
CREATE POLICY "Admins can moderate comments" ON post_comments
  FOR UPDATE USING (
    public.is_admin() OR auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Admins can delete any comment" ON post_comments;
CREATE POLICY "Admins can delete any comment" ON post_comments
  FOR DELETE USING (
    public.is_admin() OR auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Authenticated users can add comments" ON post_comments;
CREATE POLICY "Authenticated users can add comments" ON post_comments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 5. post_reactions policies
DROP POLICY IF EXISTS "Anyone can view reactions" ON post_reactions;
CREATE POLICY "Anyone can view reactions" ON post_reactions
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Authenticated users can add reactions" ON post_reactions;
CREATE POLICY "Authenticated users can add reactions" ON post_reactions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own reactions" ON post_reactions;
CREATE POLICY "Users can update own reactions" ON post_reactions
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reactions" ON post_reactions;
CREATE POLICY "Users can delete own reactions" ON post_reactions
  FOR DELETE USING (auth.uid() = user_id OR public.is_admin());

-- 6. Add admin email (needs to be run AFTER user signs up)
-- IMPORTANT: The user kesalarycalculator@gmail.com must sign up first through auth.html
-- Then run:
--
-- INSERT INTO admin_users (user_id, email, is_super_admin)
-- VALUES (
--   (SELECT id FROM auth.users WHERE email = 'kesalarycalculator@gmail.com'),
--   'kesalarycalculator@gmail.com',
--   TRUE
-- )
-- ON CONFLICT (email) DO NOTHING;

-- 7. Create function to grant admin access (for super admin use)
CREATE OR REPLACE FUNCTION public.grant_admin_access(admin_email TEXT)
RETURNS TEXT AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_super_admin = TRUE
  ) THEN
    RETURN 'ERROR: Only super admins can grant admin access';
  END IF;
  
  SELECT id INTO v_user_id FROM auth.users WHERE email = admin_email;
  
  IF v_user_id IS NULL THEN
    RETURN 'ERROR: User with email ' || admin_email || ' not found';
  END IF;
  
  INSERT INTO public.admin_users (user_id, email, is_super_admin, granted_by)
  VALUES (v_user_id, admin_email, FALSE, auth.uid())
  ON CONFLICT (email) DO NOTHING;
  
  RETURN 'SUCCESS: Admin access granted to ' || admin_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

GRANT EXECUTE ON FUNCTION public.grant_admin_access TO authenticated;

-- 8. Analytics function for admin dashboard
CREATE OR REPLACE FUNCTION get_blog_stats()
RETURNS TABLE(
  total_posts BIGINT,
  total_comments BIGINT,
  total_reactions BIGINT,
  total_views BIGINT,
  posts_this_month BIGINT,
  comments_this_month BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM blog_posts WHERE status = 'published') as total_posts,
    (SELECT COUNT(*) FROM post_comments WHERE is_approved = TRUE) as total_comments,
    (SELECT COUNT(*) FROM post_reactions) as total_reactions,
    (SELECT COALESCE(SUM(views_count), 0) FROM blog_posts) as total_views,
    (SELECT COUNT(*) FROM blog_posts WHERE created_at >= date_trunc('month', NOW())) as posts_this_month,
    (SELECT COUNT(*) FROM post_comments WHERE created_at >= date_trunc('month', NOW())) as comments_this_month;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Pending comments function for moderation
CREATE OR REPLACE FUNCTION get_pending_comments()
RETURNS TABLE(
  id UUID,
  post_id UUID,
  post_title TEXT,
  user_name TEXT,
  comment_text TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  
  RETURN QUERY
  SELECT 
    bc.id,
    bc.post_id,
    bp.title as post_title,
    bc.user_name,
    bc.comment_text,
    bc.created_at
  FROM post_comments bc
  JOIN blog_posts bp ON bc.post_id = bp.id
  WHERE bc.is_approved = FALSE
  ORDER BY bc.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_author_id ON blog_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_post_id ON post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_user_id ON post_reactions(user_id);

-- 11. View count update function
CREATE OR REPLACE FUNCTION increment_post_views_realtime(p_post_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  UPDATE blog_posts
  SET views_count = views_count + 1, updated_at = NOW()
  WHERE id = p_post_id
  RETURNING views_count INTO v_new_count;
  RETURN COALESCE(v_new_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION increment_post_views_realtime(UUID) TO anon;
GRANT EXECUTE ON FUNCTION increment_post_views_realtime(UUID) TO authenticated;

-- Setup instructions
DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Admin setup completed successfully!';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Have kesalarycalculator@gmail.com sign up via auth.html';
  RAISE NOTICE '2. Run the INSERT INTO admin_users statement above (section 6)';
  RAISE NOTICE '3. Access admin dashboard at /admin.html';
  RAISE NOTICE '===========================================';
END $$;
