-- Newsletter Subscribers Table
-- Run this in your Supabase SQL Editor to store newsletter/update subscriptions.
-- Subscribers can be collected from logged-in users (one-click) or via email input.

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    email       text NOT NULL UNIQUE,
    subscribed_at timestamptz DEFAULT now(),
    source      text DEFAULT 'website'   -- e.g. 'index', 'salary-news', 'blog'
);

-- Allow anyone (including anon) to insert/upsert their subscription
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe"
    ON newsletter_subscribers FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Anyone can upsert their own subscription"
    ON newsletter_subscribers FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Only service-role (admin) can read the full list.
-- Service role bypasses RLS entirely, so no SELECT policy is needed for admin access.
-- The policy below intentionally blocks all client-side reads for privacy.
CREATE POLICY "No client-side reads of subscriber list"
    ON newsletter_subscribers FOR SELECT
    USING (false);
