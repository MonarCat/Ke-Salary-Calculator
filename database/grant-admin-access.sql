-- Grant Super-Admin Access to kesalarycalculator@gmail.com
--
-- Prerequisites:
--   1. Run blog-setup.sql
--   2. Run admin-setup.sql
--   3. The user must have signed up via /auth.html first
--
-- Run this once in your Supabase SQL Editor.

INSERT INTO public.admin_users (user_id, email, is_super_admin)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'kesalarycalculator@gmail.com'),
  'kesalarycalculator@gmail.com',
  TRUE
)
ON CONFLICT (email) DO UPDATE
  SET user_id        = EXCLUDED.user_id,
      is_super_admin = TRUE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.admin_users WHERE email = 'kesalarycalculator@gmail.com') THEN
    RAISE NOTICE 'SUCCESS: kesalarycalculator@gmail.com now has super-admin access.';
    RAISE NOTICE 'Sign in at /admin-auth.html and go to /admin.html.';
  ELSE
    RAISE NOTICE 'WARNING: User kesalarycalculator@gmail.com was not found in auth.users.';
    RAISE NOTICE 'Please sign up at /auth.html first, then re-run this script.';
  END IF;
END $$;
