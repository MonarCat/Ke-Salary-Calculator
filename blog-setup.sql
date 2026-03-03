-- Blog Database Setup Script
-- Run this in your Supabase SQL Editor

-- 1. Create blog_posts table
CREATE TABLE IF NOT EXISTS blog_posts (
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

-- 2. Create post_comments table
CREATE TABLE IF NOT EXISTS post_comments (
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

-- 3. Create post_reactions table
CREATE TABLE IF NOT EXISTS post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'love', 'insightful', 'celebrate', 'support')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- 4. Create comment_reactions table
CREATE TABLE IF NOT EXISTS comment_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'love', 'insightful', 'celebrate', 'support')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

-- Add UNIQUE constraints if table already exists without them (safe migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'post_reactions_post_id_user_id_key'
      AND conrelid = 'post_reactions'::regclass
  ) THEN
    -- Remove duplicate reactions keeping the latest per (post_id, user_id)
    DELETE FROM post_reactions a USING post_reactions b
    WHERE a.id < b.id AND a.post_id = b.post_id AND a.user_id = b.user_id;
    ALTER TABLE post_reactions ADD CONSTRAINT post_reactions_post_id_user_id_key UNIQUE (post_id, user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'comment_reactions_comment_id_user_id_key'
      AND conrelid = 'comment_reactions'::regclass
  ) THEN
    -- Remove duplicate reactions keeping the latest per (comment_id, user_id)
    DELETE FROM comment_reactions a USING comment_reactions b
    WHERE a.id < b.id AND a.comment_id = b.comment_id AND a.user_id = b.user_id;
    ALTER TABLE comment_reactions ADD CONSTRAINT comment_reactions_comment_id_user_id_key UNIQUE (comment_id, user_id);
  END IF;
END $$;

-- 5. Enable Row Level Security
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;

-- 5a. Add UNIQUE constraints if they don't already exist (for existing databases)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'post_reactions_post_id_user_id_key'
  ) THEN
    ALTER TABLE post_reactions ADD CONSTRAINT post_reactions_post_id_user_id_key UNIQUE (post_id, user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'comment_reactions_comment_id_user_id_key'
  ) THEN
    ALTER TABLE comment_reactions ADD CONSTRAINT comment_reactions_comment_id_user_id_key UNIQUE (comment_id, user_id);
  END IF;
END $$;

-- 6. Create RLS Policies for blog_posts
DROP POLICY IF EXISTS "Anyone can view published posts" ON blog_posts;
CREATE POLICY "Anyone can view published posts" ON blog_posts
  FOR SELECT USING (status = 'published');

DROP POLICY IF EXISTS "Authenticated users can create posts" ON blog_posts;
CREATE POLICY "Authenticated users can create posts" ON blog_posts
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authors can update own posts" ON blog_posts;
CREATE POLICY "Authors can update own posts" ON blog_posts
  FOR UPDATE USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors can delete own posts" ON blog_posts;
CREATE POLICY "Authors can delete own posts" ON blog_posts
  FOR DELETE USING (auth.uid() = author_id);

-- 7. Create RLS Policies for post_comments
DROP POLICY IF EXISTS "Anyone can view approved comments" ON post_comments;
CREATE POLICY "Anyone can view approved comments" ON post_comments
  FOR SELECT USING (is_approved = TRUE);

-- Rate-limit helper: allows at most 5 comments per authenticated user per hour.
-- SECURITY DEFINER so the function can count rows without exposing other users' data.
CREATE OR REPLACE FUNCTION check_comment_rate_limit()
RETURNS BOOLEAN AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM post_comments
  WHERE user_id = auth.uid()
    AND created_at > NOW() - INTERVAL '1 hour';
  RETURN recent_count < 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Authenticated users can create comments" ON post_comments;
-- Server-side guard: the post must exist and be published (complements the
-- client-side UUID check), and the user must not exceed the per-hour rate limit.
CREATE POLICY "Authenticated users can create comments" ON post_comments
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND check_comment_rate_limit()
    AND EXISTS (
      SELECT 1 FROM blog_posts
      WHERE id = post_id AND status = 'published'
    )
  );

DROP POLICY IF EXISTS "Users can update own comments" ON post_comments;
CREATE POLICY "Users can update own comments" ON post_comments
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own comments" ON post_comments;
CREATE POLICY "Users can delete own comments" ON post_comments
  FOR DELETE USING (auth.uid() = user_id);

-- 8. Create RLS Policies for post_reactions
DROP POLICY IF EXISTS "Anyone can view reactions" ON post_reactions;
CREATE POLICY "Anyone can view reactions" ON post_reactions
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Authenticated users can create reactions" ON post_reactions;
CREATE POLICY "Authenticated users can create reactions" ON post_reactions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete own reactions" ON post_reactions;
CREATE POLICY "Users can delete own reactions" ON post_reactions
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own reactions" ON post_reactions;
CREATE POLICY "Users can update own reactions" ON post_reactions
  FOR UPDATE USING (auth.uid() = user_id);

-- 9. Create RLS Policies for comment_reactions
DROP POLICY IF EXISTS "Anyone can view comment reactions" ON comment_reactions;
CREATE POLICY "Anyone can view comment reactions" ON comment_reactions
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Authenticated users can create comment reactions" ON comment_reactions;
CREATE POLICY "Authenticated users can create comment reactions" ON comment_reactions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete own comment reactions" ON comment_reactions;
CREATE POLICY "Users can delete own comment reactions" ON comment_reactions
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own comment reactions" ON comment_reactions;
CREATE POLICY "Users can update own comment reactions" ON comment_reactions
  FOR UPDATE USING (auth.uid() = user_id);

-- 10. Create Indexes
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_post_id ON post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_user_id ON post_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_user_id ON post_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_id ON comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_user_id ON comment_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at DESC);

-- 11. Create Functions
CREATE OR REPLACE FUNCTION increment_post_views(p_post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE blog_posts
  SET views_count = views_count + 1
  WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow any visitor (anon) or signed-in user to call the view-increment RPC.
-- SECURITY DEFINER means the function itself has permission to UPDATE blog_posts
-- regardless of the caller's role; we only need to grant EXECUTE here.
GRANT EXECUTE ON FUNCTION increment_post_views(UUID) TO anon;
GRANT EXECUTE ON FUNCTION increment_post_views(UUID) TO authenticated;

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

-- 12. Create Triggers (use existing update_updated_at function)
DROP TRIGGER IF EXISTS update_blog_posts_updated_at ON blog_posts;
CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_post_comments_updated_at ON post_comments;
CREATE TRIGGER update_post_comments_updated_at
  BEFORE UPDATE ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 13. Insert the first blog post about Kenya tax abolition
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
  '<h2>A New Dawn for Low-Income Earners in Kenya</h2>
<p>In a significant policy development that could reshape Kenya''s tax landscape, the National Treasury and the Office of the President have hinted at a groundbreaking proposal to abolish income tax for individuals earning below KES 30,000 per month. This potential reform comes at a critical time when many Kenyans are grappling with the rising cost of living and economic pressures.</p>

<h2>Understanding the Current Tax Framework</h2>
<p>Currently, Kenya''s Pay As You Earn (PAYE) system requires all employees earning above KES 24,000 per month to pay income tax. The progressive tax rates start at 10% for income up to KES 24,000, rising to 35% for income above KES 800,000 per month. For workers earning between KES 24,000 and KES 30,000, even a small percentage of tax can significantly impact their take-home pay, especially when combined with other statutory deductions like NSSF, SHIF, and the Housing Levy.</p>

<h2>The Proposed Tax Relief: What It Means</h2>
<p>The proposed tax abolition for earners below KES 30,000 would mean:</p>
<ul>
<li><strong>Immediate increase in take-home pay:</strong> Workers in this bracket would see an instant boost in their net income, providing much-needed relief for household budgets.</li>
<li><strong>Economic stimulus:</strong> With more disposable income, low-income earners are likely to increase consumer spending, potentially boosting local businesses and the broader economy.</li>
<li><strong>Poverty alleviation:</strong> The extra income could help families meet basic needs such as food, education, and healthcare more comfortably.</li>
<li><strong>Reduced administrative burden:</strong> Employers managing payroll for low-wage workers would have simpler tax calculations to handle.</li>
</ul>

<h2>The Role of Kenya Bankers Association</h2>
<p>The <strong>Kenya Bankers Association (KBA)</strong> plays a crucial role in this economic narrative. As the representative body of Kenya''s banking sector, KBA has been instrumental in:</p>
<ul>
<li><strong>Policy advocacy:</strong> The association regularly engages with the government on fiscal policies that affect financial inclusion and economic growth.</li>
<li><strong>Financial literacy:</strong> KBA promotes financial education programs that help Kenyans better manage their money, including understanding tax implications on savings and investments.</li>
<li><strong>Digital financial services:</strong> Banks under KBA''s umbrella have pioneered mobile banking and digital payment solutions that help workers access their salaries more efficiently and at lower costs.</li>
<li><strong>Supporting MSMEs:</strong> The association has championed initiatives to support Micro, Small, and Medium Enterprises, which employ a significant portion of workers earning below KES 30,000.</li>
</ul>

<blockquote>
"Financial inclusion is not just about access to banking services; it''s about ensuring that every Kenyan worker can maximize their earnings and build a secure financial future," notes a recent KBA policy brief.
</blockquote>

<h2>Economic Implications and Considerations</h2>
<p>While the proposed tax relief would be welcome news for low-income earners, experts point out several considerations:</p>

<h3>Revenue Impact</h3>
<p>The government would need to compensate for the lost tax revenue, which could come from other sources such as increased VAT, excise duties, or improved tax collection efficiency. The Kenya Revenue Authority (KRA) has been working on modernizing tax collection systems to reduce leakages and increase compliance among higher-income earners and corporations.</p>

<h3>Inflation Concerns</h3>
<p>Economists warn that putting more money in circulation could potentially drive up inflation if not managed carefully. However, targeted relief for low-income earners is generally considered less inflationary than broad-based tax cuts.</p>

<h3>Implementation Timeline</h3>
<p>If approved, the tax reform would likely be implemented in phases, possibly starting in the next financial year. This would give employers, payroll systems, and the KRA time to adjust their processes.</p>

<h2>What This Means for Your Salary</h2>
<p>If you earn below KES 30,000 per month, here''s what to expect:</p>
<ul>
<li><strong>Zero PAYE tax:</strong> Your current PAYE deduction would be eliminated completely.</li>
<li><strong>Statutory deductions remain:</strong> You would still contribute to NSSF (6% up to KES 2,160), SHIF (2.75%), and the Housing Levy (1.5%).</li>
<li><strong>Immediate impact:</strong> For someone earning KES 30,000, this could mean an extra KES 1,500 to KES 2,000 in their pocket each month.</li>
</ul>

<h2>Banking Sector Response</h2>
<p>Kenya Bankers Association has expressed cautious optimism about the proposal. In a statement, the association highlighted that increased disposable income among low-earners could lead to:</p>
<ul>
<li>Higher savings deposits in banks</li>
<li>Increased demand for financial products like micro-loans and insurance</li>
<li>Better debt servicing rates as people have more money to meet their obligations</li>
<li>Growth in digital banking transactions</li>
</ul>

<h2>Regional Context and Comparisons</h2>
<p>Kenya''s potential move aligns with similar tax relief measures seen in other African countries. Uganda recently raised its tax-free threshold, while Rwanda has implemented progressive reforms to reduce the tax burden on low-income workers. These regional developments show a growing recognition of the need to protect vulnerable workers from excessive taxation.</p>

<h2>How to Prepare</h2>
<p>While we await official confirmation and implementation details, here''s what you can do:</p>
<ol>
<li><strong>Review your current payslip:</strong> Understand exactly how much PAYE you''re currently paying using our <a href="/calculator.html">free salary calculator</a>.</li>
<li><strong>Plan your budget:</strong> Think about how you would use the extra income - whether for savings, investment, or meeting immediate needs.</li>
<li><strong>Stay informed:</strong> Keep checking official government channels and credible news sources for updates on the proposal.</li>
<li><strong>Consult your employer:</strong> If the reform is implemented, ensure your employer updates their payroll system accordingly.</li>
</ol>

<h2>The Road Ahead</h2>
<p>The proposal for tax abolition for earners below KES 30,000 represents a significant step towards making Kenya''s tax system more equitable and pro-poor. However, the devil will be in the details - particularly how the government plans to offset the revenue loss and ensure sustainable public finance management.</p>

<p>As this story develops, the collaboration between the National Treasury, Kenya Revenue Authority, and stakeholders like the Kenya Bankers Association will be crucial in crafting a policy that balances economic growth, fiscal responsibility, and social welfare.</p>

<h2>Stay Updated</h2>
<p>We''ll continue to monitor this developing story and provide updates as more information becomes available. Make sure to bookmark our blog and follow us for the latest news on tax policies, salary calculations, and financial tips for Kenyan workers.</p>

<p><em>Want to see how this tax relief would affect your specific salary? Try our <a href="/calculator.html" style="color: #006600; font-weight: bold;">Kenya Salary Calculator</a> to understand your current deductions and potential take-home pay under the new proposal.</em></p>',
  'kenyan-economy-coins.jpg',
  'Admin',
  'published'
) ON CONFLICT (slug) DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Blog database setup completed successfully!';
  RAISE NOTICE 'First blog post about Kenya tax abolition has been created.';
  RAISE NOTICE 'You can now access the blog at: /blog.html';
END $$;
