# Blog Database Schema

This document outlines the database schema for the blog feature including posts, comments, and reactions.

## Tables

### 1. blog_posts

Stores blog articles with images and metadata.

```sql
CREATE TABLE blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  featured_image_url TEXT,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT DEFAULT 'Admin',
  status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read published posts
CREATE POLICY "Anyone can view published posts" ON blog_posts
  FOR SELECT USING (status = 'published');

-- Policy: Authenticated users can create posts
CREATE POLICY "Authenticated users can create posts" ON blog_posts
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy: Authors can update their own posts
CREATE POLICY "Authors can update own posts" ON blog_posts
  FOR UPDATE USING (auth.uid() = author_id);

-- Policy: Authors can delete their own posts
CREATE POLICY "Authors can delete own posts" ON blog_posts
  FOR DELETE USING (auth.uid() = author_id);
```

### 2. post_comments

Stores user comments on blog posts.

```sql
CREATE TABLE post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  user_email TEXT,
  comment_text TEXT NOT NULL,
  parent_comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE,
  is_approved BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read approved comments
CREATE POLICY "Anyone can view approved comments" ON post_comments
  FOR SELECT USING (is_approved = TRUE);

-- Policy: Authenticated users can create comments
CREATE POLICY "Authenticated users can create comments" ON post_comments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy: Users can update their own comments
CREATE POLICY "Users can update own comments" ON post_comments
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own comments
CREATE POLICY "Users can delete own comments" ON post_comments
  FOR DELETE USING (auth.uid() = user_id);
```

### 3. post_reactions

Stores user reactions (like, love, insightful, etc.) to blog posts.

```sql
CREATE TABLE post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'love', 'insightful', 'celebrate', 'support')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read reactions
CREATE POLICY "Anyone can view reactions" ON post_reactions
  FOR SELECT USING (TRUE);

-- Policy: Authenticated users can create reactions
CREATE POLICY "Authenticated users can create reactions" ON post_reactions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy: Users can delete their own reactions
CREATE POLICY "Users can delete own reactions" ON post_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- Policy: Users can update their own reactions (change reaction type)
CREATE POLICY "Users can update own reactions" ON post_reactions
  FOR UPDATE USING (auth.uid() = user_id);
```

### 4. comment_reactions

Stores user reactions to individual comments.

```sql
CREATE TABLE comment_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'love', 'insightful', 'celebrate', 'support')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read comment reactions
CREATE POLICY "Anyone can view comment reactions" ON comment_reactions
  FOR SELECT USING (TRUE);

-- Policy: Authenticated users can create comment reactions
CREATE POLICY "Authenticated users can create comment reactions" ON comment_reactions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy: Users can delete their own comment reactions
CREATE POLICY "Users can delete own comment reactions" ON comment_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- Policy: Users can update their own comment reactions
CREATE POLICY "Users can update own comment reactions" ON comment_reactions
  FOR UPDATE USING (auth.uid() = user_id);
```

## Indexes

```sql
-- Optimize queries by post_id
CREATE INDEX idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX idx_post_reactions_post_id ON post_reactions(post_id);

-- Optimize queries by user_id
CREATE INDEX idx_post_comments_user_id ON post_comments(user_id);
CREATE INDEX idx_post_reactions_user_id ON post_reactions(user_id);

-- Optimize comment reactions queries
CREATE INDEX idx_comment_reactions_comment_id ON comment_reactions(comment_id);
CREATE INDEX idx_comment_reactions_user_id ON comment_reactions(user_id);

-- Optimize blog post queries
CREATE INDEX idx_blog_posts_status ON blog_posts(status);
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_published_at ON blog_posts(published_at DESC);
```

## Functions

### Function: Get reaction counts for a post

```sql
CREATE OR REPLACE FUNCTION get_reaction_counts(p_post_id UUID)
RETURNS TABLE(reaction_type TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT br.reaction_type, COUNT(*) as count
  FROM post_reactions br
  WHERE br.post_id = p_post_id
  GROUP BY br.reaction_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Function: Increment view count

```sql
CREATE OR REPLACE FUNCTION increment_post_views(p_post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE blog_posts
  SET views_count = views_count + 1
  WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Function: Get comment count for a post

```sql
CREATE OR REPLACE FUNCTION get_comment_count(p_post_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM post_comments
  WHERE post_id = p_post_id AND is_approved = TRUE;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Triggers

### Auto-update timestamp

```sql
CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_post_comments_updated_at
  BEFORE UPDATE ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

## Initial Data

Insert the first blog post about Kenya tax abolition:

```sql
INSERT INTO blog_posts (
  title,
  slug,
  excerpt,
  content,
  featured_image_url,
  author_name,
  status
) VALUES (
  'Kenya Treasury Hints at Tax Abolition for Low-Income Earners Below KES 30,000',
  'kenya-tax-abolition-below-30000',
  'The Kenya National Treasury and the Presidency are considering a significant policy shift that could see individuals earning below KES 30,000 per month exempted from income tax. This move aims to provide relief to low-income earners and stimulate economic growth.',
  '<article content will be added in the blog post creation>',
  'kenyan-economy-coins.jpg',
  'Admin',
  'published'
);
```

## Notes

- All blog posts are publicly readable when published
- Only authenticated users can comment and react
- Comments can be nested (replies) using parent_comment_id
- Reactions are limited to one per user per post (UNIQUE constraint)
- View counts are incremented automatically when posts are viewed
- The author_name defaults to 'Admin' for system-generated posts
