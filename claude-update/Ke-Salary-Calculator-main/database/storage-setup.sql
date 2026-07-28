-- Supabase Storage Setup for Blog Images
-- Run this in your Supabase SQL Editor AFTER running blog-setup.sql and admin-setup.sql

-- 1. Create the blog-images storage bucket (public – images are served directly)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'blog-images',
  'blog-images',
  TRUE,
  5242880,  -- 5 MB per file
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public            = TRUE,
  file_size_limit   = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- 2. RLS policies for storage.objects

-- Anyone can read (download/view) images in the bucket
DROP POLICY IF EXISTS "Public read blog images" ON storage.objects;
CREATE POLICY "Public read blog images" ON storage.objects
  FOR SELECT USING (bucket_id = 'blog-images');

-- Only admins can upload images
DROP POLICY IF EXISTS "Admins can upload blog images" ON storage.objects;
CREATE POLICY "Admins can upload blog images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'blog-images'
    AND public.is_admin()
  );

-- Only admins can update (replace) images
DROP POLICY IF EXISTS "Admins can update blog images" ON storage.objects;
CREATE POLICY "Admins can update blog images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'blog-images'
    AND public.is_admin()
  );

-- Only admins can delete images
DROP POLICY IF EXISTS "Admins can delete blog images" ON storage.objects;
CREATE POLICY "Admins can delete blog images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'blog-images'
    AND public.is_admin()
  );

DO $$
BEGIN
  RAISE NOTICE 'Storage setup complete.';
  RAISE NOTICE 'Bucket "blog-images" is ready.';
  RAISE NOTICE 'Only admins can upload/delete; everyone can view.';
END $$;
