-- Migration: Add secondary_image_url to blog_posts
-- Run this in your Supabase SQL Editor

ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS secondary_image_url TEXT;

-- Update post-6 (PAYE exemption) to use CS Mbadi's photo
UPDATE blog_posts
SET secondary_image_url = 'assets/images/kenyan-economy-coins.jpg',
    featured_image_url  = 'assets/images/National Treasury CS John Mbadi.jpeg',
    updated_at          = NOW()
WHERE slug = 'paye-exemption-below-30000-proposal';

DO $$
BEGIN
  RAISE NOTICE 'Migration complete: secondary_image_url column added to blog_posts.';
END $$;
