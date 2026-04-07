# COPILOT TASK — Fix Premium Subscription Status Detection
**Project:** salarycalculator.co.ke  
**Repo:** `MonarCat/Ke-Salary-Calculator`  
**Hosting:** Vercel | **Node.js:** 24.x  
**Supabase Project:** `wklhcmaodxatavuoduhd.supabase.co`  
**Payment:** Paystack (KES 499/month, KES 4,999/year)  
**Contact:** kesalarycalculator@gmail.com  

---

## PROBLEM STATEMENT

Users complete payment via Paystack successfully. Paystack processes it correctly. But when the user returns to the site:
- The UI still shows **"Free Plan"**
- Premium features remain **gated/locked**
- The upgrade modal still fires
- The user's experience is broken and trust is destroyed

This is a **critical revenue and credibility bug**. Fix it completely and permanently.

---

## KNOWN HISTORY & GOTCHAS (Read Before Touching Anything)

These bugs have bitten us before — do NOT repeat them:

1. **Wrong table for email lookup** — Paystack webhooks must look up users in `auth.users`, NOT `user_profiles`. The email from the webhook payload must be matched against `auth.users.email`.

2. **`bodyParser: false` is mandatory** — The Paystack webhook handler at `/api/paystack-webhook` must have `bodyParser: false` in its Vercel config. Without it, the raw body is consumed before HMAC verification, causing all webhook signature checks to fail silently.

3. **`premium_source` CHECK constraint** — The `user_profiles` table has a CHECK constraint on `premium_source`. The value `'paystack'` must be explicitly allowed. If not, Supabase will silently reject the UPDATE and the user remains on Free Plan.

4. **Plan codes must never be hardcoded** — Plan codes are read from `window.__PAYSTACK_PLAN_MONTHLY` and `window.__PAYSTACK_PLAN_YEARLY`. Do not hardcode them anywhere.

5. **Supabase RLS** — Avoid policies that query `user_profiles` recursively. Use a `SECURITY DEFINER` function `get_my_role()` if role checks are needed.

---

## FULL DIAGNOSIS CHECKLIST

Work through every layer before writing any fix. Document what you find at each step.

### Layer 1 — Paystack Webhook (`/api/paystack-webhook.js`)

- [ ] Is `bodyParser: false` set in the Vercel function config?
- [ ] Is the HMAC signature (`x-paystack-signature`) being verified correctly against the raw body?
- [ ] On a `charge.success` event, is the user's email being extracted from `data.customer.email`?
- [ ] Is the email being looked up in `auth.users` (NOT `user_profiles`)?
- [ ] After finding the user's UUID from `auth.users`, is `user_profiles` being updated with:
  - `is_premium = true`
  - `premium_source = 'paystack'`
  - `subscription_plan` = correct plan string (`'monthly'` or `'yearly'`)
  - `subscription_start` = current timestamp
  - `subscription_end` = calculated expiry (30 days or 365 days)
- [ ] Is the Supabase client in the webhook using the **Service Role key** (not the anon key)?
- [ ] Are webhook errors being logged to Vercel logs?
- [ ] Does the function return HTTP 200 on success? (Paystack retries on non-200)

### Layer 2 — Supabase `user_profiles` Table Schema

Run these queries in Supabase SQL editor and confirm:

```sql
-- Confirm columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles';

-- Confirm CHECK constraint allows 'paystack'
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'user_profiles'::regclass;

-- Spot-check a real paying user
SELECT id, email, is_premium, premium_source, subscription_plan, subscription_end
FROM user_profiles
WHERE email = '<test_user_email>';
```

If `premium_source` CHECK constraint does NOT include `'paystack'`, run:

```sql
ALTER TABLE user_profiles
DROP CONSTRAINT IF EXISTS user_profiles_premium_source_check;

ALTER TABLE user_profiles
ADD CONSTRAINT user_profiles_premium_source_check
CHECK (premium_source IN ('paystack', 'manual', 'promo', null));
```

### Layer 3 — Supabase RLS Policies

```sql
-- Check existing policies on user_profiles
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'user_profiles';
```

Ensure:
- Authenticated users can SELECT their own row (`auth.uid() = id`)
- The webhook's service role bypasses RLS (service role always bypasses RLS — confirm you're using it)
- No policy is doing a recursive lookup that deadlocks the read

### Layer 4 — Frontend Auth & Premium Status Read

Find wherever the frontend reads the user's plan. It likely does one of:
- Reads `user_profiles` via Supabase client on login/session
- Stores premium status in `localStorage` or React state
- Uses a context/store that is populated once and never refreshed

Check:
- [ ] Is premium status fetched fresh from `user_profiles` on every session start?
- [ ] Is there any caching (`localStorage`, `sessionStorage`) of `is_premium` that survives a new payment without clearing?
- [ ] After Paystack redirect back to the site, is there a re-fetch of the user profile?
- [ ] Is the gating logic reading from a stale in-memory value set at login time?

### Layer 5 — Paystack Callback / Redirect URL

When Paystack completes payment, it redirects the user to a callback URL.

- [ ] What is the callback URL configured in Paystack dashboard?
- [ ] Does the callback page/route re-fetch the user's profile from Supabase immediately?
- [ ] Does the callback verify payment independently using Paystack's **Verify Transaction** API (`GET /transaction/verify/:reference`) before granting premium?

---

## FIXES TO IMPLEMENT

### Fix 1 — Webhook Handler (`/api/paystack-webhook.js`)

Rewrite to be bulletproof:

```javascript
// /api/paystack-webhook.js
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } }; // CRITICAL

const getRawBody = (req) =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const signature = req.headers['x-paystack-signature'];
  const secret = process.env.PAYSTACK_SECRET_KEY;

  const hash = crypto
    .createHmac('sha512', secret)
    .update(rawBody)
    .digest('hex');

  if (hash !== signature) {
    console.error('[Webhook] Signature mismatch — rejected');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(rawBody);
  console.log('[Webhook] Event received:', event.event);

  if (event.event !== 'charge.success') {
    return res.status(200).json({ received: true });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // MUST be service role
  );

  const customerEmail = event.data?.customer?.email;
  const planCode = event.data?.plan?.plan_code || null;
  const reference = event.data?.reference;

  if (!customerEmail) {
    console.error('[Webhook] No customer email in payload');
    return res.status(200).json({ received: true });
  }

  // Step 1: Look up user in auth.users (NOT user_profiles)
  const { data: authUsers, error: authError } = await supabase
    .from('auth.users') // use rpc or admin API
    .select('id')
    .eq('email', customerEmail)
    .limit(1);

  // Use admin API for auth.users lookup
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('[Webhook] Auth lookup error:', listError);
    return res.status(500).json({ error: 'Auth lookup failed' });
  }

  const authUser = users.find((u) => u.email === customerEmail);
  if (!authUser) {
    console.error('[Webhook] No auth user found for email:', customerEmail);
    return res.status(200).json({ received: true }); // Still 200 so Paystack doesn't retry forever
  }

  // Step 2: Determine plan duration
  const monthlyPlanCode = process.env.PAYSTACK_PLAN_MONTHLY;
  const yearlyPlanCode = process.env.PAYSTACK_PLAN_YEARLY;
  const isYearly = planCode === yearlyPlanCode;
  const daysToAdd = isYearly ? 365 : 30;
  const subscriptionEnd = new Date();
  subscriptionEnd.setDate(subscriptionEnd.getDate() + daysToAdd);

  // Step 3: Update user_profiles
  const { error: updateError } = await supabase
    .from('user_profiles')
    .upsert({
      id: authUser.id,
      email: customerEmail,
      is_premium: true,
      premium_source: 'paystack',
      subscription_plan: isYearly ? 'yearly' : 'monthly',
      subscription_start: new Date().toISOString(),
      subscription_end: subscriptionEnd.toISOString(),
      paystack_reference: reference,
    }, { onConflict: 'id' });

  if (updateError) {
    console.error('[Webhook] Profile update error:', updateError);
    return res.status(500).json({ error: 'Profile update failed' });
  }

  console.log('[Webhook] Premium activated for:', customerEmail);
  return res.status(200).json({ success: true });
}
```

### Fix 2 — Paystack Callback Page (Post-Payment Redirect)

After Paystack redirects the user back to the site, the callback page must independently verify the transaction and refresh the user's profile. Add this logic to whatever route handles the Paystack return URL:

```javascript
// In your callback route/component
const verifyAndActivate = async (reference) => {
  // 1. Verify with Paystack API
  const verifyRes = await fetch(`/api/verify-payment?reference=${reference}`);
  const { success } = await verifyRes.json();

  if (!success) {
    showError('Payment could not be verified. Contact support.');
    return;
  }

  // 2. Re-fetch user profile from Supabase (bypass any cache)
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('is_premium, subscription_plan, subscription_end')
    .eq('id', supabase.auth.getUser().id)
    .single();

  if (profile?.is_premium) {
    // 3. Update global state / context / localStorage
    setUserPlan('premium'); // or however your state is managed
    showSuccess('Welcome to Premium! All features unlocked.');
  }
};
```

Also create `/api/verify-payment.js`:

```javascript
// /api/verify-payment.js
export default async function handler(req, res) {
  const { reference } = req.query;
  if (!reference) return res.status(400).json({ success: false });

  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${reference}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    }
  );

  const data = await response.json();
  if (data.data?.status === 'success') {
    return res.status(200).json({ success: true, data: data.data });
  }

  return res.status(200).json({ success: false });
}
```

### Fix 3 — Frontend Premium Gate Logic

Find the component/hook that gates premium features. It should work like this:

```javascript
// hooks/usePremiumStatus.js
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export function usePremiumStatus(userId) {
  const [isPremium, setIsPremium] = useState(null); // null = loading
  const [plan, setPlan] = useState('free');

  useEffect(() => {
    if (!userId) return;

    const fetchStatus = async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('is_premium, subscription_plan, subscription_end')
        .eq('id', userId)
        .single();

      if (error || !data) {
        setIsPremium(false);
        return;
      }

      // Check subscription hasn't expired
      const now = new Date();
      const expiry = data.subscription_end ? new Date(data.subscription_end) : null;
      const active = data.is_premium && (!expiry || expiry > now);

      setIsPremium(active);
      setPlan(active ? data.subscription_plan : 'free');
    };

    fetchStatus();
  }, [userId]);

  return { isPremium, plan };
}
```

**Rules for gating:**
- Never read `isPremium` from `localStorage` alone — always source from Supabase
- While `isPremium === null` (loading), show a skeleton/spinner — do NOT show the upgrade modal
- Only show the upgrade modal when `isPremium === false` AND the user is authenticated AND the profile fetch is complete

### Fix 4 — Environment Variables (Verify All Exist on Vercel)

In Vercel → Project → Settings → Environment Variables, confirm ALL of these exist:

| Variable | Purpose |
|---|---|
| `PAYSTACK_SECRET_KEY` | HMAC signing + verify API |
| `PAYSTACK_PLAN_MONTHLY` | Monthly plan code from Paystack dashboard |
| `PAYSTACK_PLAN_YEARLY` | Yearly plan code from Paystack dashboard |
| `VITE_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role — for webhook only, never expose to client |
| `VITE_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key for client-side |

### Fix 5 — Supabase Schema Hardening

Run in Supabase SQL Editor:

```sql
-- Ensure user_profiles has all required columns
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS premium_source TEXT,
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT,
  ADD COLUMN IF NOT EXISTS subscription_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paystack_reference TEXT;

-- Fix CHECK constraint to allow 'paystack'
ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_premium_source_check;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_premium_source_check
  CHECK (premium_source IN ('paystack', 'manual', 'promo') OR premium_source IS NULL);

-- RLS: users can read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- RLS: users can update their own profile (limited columns)
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Service role bypasses RLS automatically — no policy needed for webhook
```

---

## TESTING PROTOCOL

After applying all fixes, test this exact flow end-to-end:

1. **Create a test user** — register a fresh account on the site
2. **Initiate payment** — go through Paystack checkout (use test mode keys and test card: `4084084084084081`, CVV: `408`, expiry: any future date)
3. **Check Vercel logs** — immediately after payment, confirm the webhook log shows `[Webhook] Premium activated for: <email>`
4. **Check Supabase** — run `SELECT is_premium, premium_source, subscription_plan, subscription_end FROM user_profiles WHERE email = '<email>'` — must show `true`, `'paystack'`, correct plan, future date
5. **Check callback page** — user should land on a success page that re-fetches profile and shows "Premium Unlocked"
6. **Refresh the app** — on full page reload, user must still see Premium status and all features unlocked
7. **Test gating logic** — confirm no upgrade modal fires for this user
8. **Test expiry logic** — temporarily set `subscription_end` to a past date in Supabase and confirm the frontend correctly downgrades to Free

---

## DELIVERABLES

1. `/api/paystack-webhook.js` — rewritten, bulletproof
2. `/api/verify-payment.js` — new, called on callback
3. `hooks/usePremiumStatus.js` (or equivalent) — clean hook sourcing from Supabase
4. Updated callback/redirect page component with re-fetch logic
5. Supabase SQL migration file with all schema fixes
6. Vercel environment variable checklist — confirmed complete
7. End-to-end test results logged

---

## SUCCESS CRITERIA

- A user who pays via Paystack sees **Premium** status immediately on return to site
- Refresh, logout, and re-login all preserve Premium status
- No upgrade modal fires for active premium users
- Expired subscriptions correctly revert to Free
- All Vercel webhook logs show clean success entries
- Zero silent failures in Supabase updates
