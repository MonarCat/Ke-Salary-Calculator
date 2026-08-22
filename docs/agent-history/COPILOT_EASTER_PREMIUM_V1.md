# COPILOT PROMPT — Easter Gift Premium Update
**Project:** salarycalculator.co.ke  
**Repo:** https://github.com/MonarCat/Ke-Salary-Calculator  
**Supabase Project:** wklhcmaodxatavuoduhd  
**Date:** 7 April 2026  
**Purpose:** Update frontend + backend logic so all authenticated users enjoy premium features until 30 April 2026 (Easter Gift), communicate this clearly in the UI, and ensure new Paystack subscribers get proper `premium_expires_at` date extensions.

---

## CONTEXT — What Changed in the Database

All 61 users in `user_profiles` now have:
```
premium              = TRUE
premium_source       = 'easter_gift_2026'
premium_activated_at = NOW()
premium_expires_at   = '2026-04-30 23:59:59+03'
```

The `premium_source` CHECK constraint now allows:
`'paystack' | 'mpesa' | 'manual' | 'promo' | 'easter_gift_2026'`

---

## TASK 1 — Update Premium Check Utility

**Goal:** Replace any hard `profile.premium === true` checks with a robust `isPremium()` helper that validates both the boolean AND the expiry date.

Find the file where premium status is read (likely `src/lib/auth.js`, `src/utils/premium.js`, `src/hooks/useAuth.js`, or similar). Add/replace with:

```javascript
// utils/premium.js  (create if it doesn't exist)

/**
 * Returns true if the user currently has active premium access.
 * Checks both the boolean flag AND premium_expires_at.
 * A null expiry means the premium never expires (treat as active).
 */
export function isPremium(profile) {
  if (!profile) return false;
  if (!profile.premium) return false;

  // If no expiry date set, treat as lifetime/manual premium
  if (!profile.premium_expires_at) return true;

  return new Date(profile.premium_expires_at) > new Date();
}

/**
 * Returns the premium source label for UI display.
 */
export function getPremiumLabel(profile) {
  const sourceMap = {
    paystack:          'Paystack Subscription',
    mpesa:             'M-Pesa Subscription',
    manual:            'Manual Grant',
    promo:             'Promo Access',
    easter_gift_2026:  '🐣 Easter Holiday Gift',
  };
  return sourceMap[profile?.premium_source] || 'Premium';
}

/**
 * Returns formatted expiry string, e.g. "30 Apr 2026"
 */
export function getPremiumExpiry(profile) {
  if (!profile?.premium_expires_at) return null;
  return new Date(profile.premium_expires_at).toLocaleDateString('en-KE', {
    day:   'numeric',
    month: 'short',
    year:  'numeric',
  });
}
```

**Then find every place in the codebase that checks premium status:**
```bash
grep -r "premium" src/ --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" -l
```

Replace all patterns like:
```javascript
// ❌ OLD — does not check expiry
if (profile.premium) { ... }
if (user.premium === true) { ... }
if (!profile.premium) { showUpgradeModal() }

// ✅ NEW
import { isPremium } from '../utils/premium';
if (isPremium(profile)) { ... }
if (!isPremium(profile)) { showUpgradeModal() }
```

---

## TASK 2 — Easter Gift Banner Component

**Goal:** Show a warm, dismissible banner to users who have the Easter gift. It should display the source label and expiry date. Dismiss state stored in `sessionStorage` so it doesn't re-appear during the session.

Create `src/components/EasterGiftBanner.jsx` (or `.tsx`):

```jsx
import { isPremium, getPremiumExpiry } from '../utils/premium';

export default function EasterGiftBanner({ profile }) {
  const [dismissed, setDismissed] = React.useState(
    () => sessionStorage.getItem('easter_banner_dismissed') === 'true'
  );

  // Only show for Easter gift users with active premium
  if (
    dismissed ||
    !isPremium(profile) ||
    profile?.premium_source !== 'easter_gift_2026'
  ) return null;

  const expiry = getPremiumExpiry(profile);

  const handleDismiss = () => {
    sessionStorage.setItem('easter_banner_dismissed', 'true');
    setDismissed(true);
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #2D6A4F 0%, #40916C 100%)',
      color: '#fff',
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      fontSize: '14px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    }}>
      <span>
        🐣 <strong>Easter Holiday Gift:</strong> You have full Premium access
        {expiry && <> until <strong>{expiry}</strong></>}. Enjoy all features — from us to you! 🎉
      </span>
      <button
        onClick={handleDismiss}
        style={{
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.5)',
          color: '#fff',
          borderRadius: '4px',
          padding: '4px 10px',
          cursor: 'pointer',
          fontSize: '12px',
          whiteSpace: 'nowrap',
        }}
      >
        Got it ✓
      </button>
    </div>
  );
}
```

**Mount the banner** in your main layout (e.g. `App.jsx`, `Layout.jsx`, or `Dashboard.jsx`) at the very top, below the navbar:

```jsx
import EasterGiftBanner from './components/EasterGiftBanner';

// Inside your layout JSX:
<EasterGiftBanner profile={profile} />
```

---

## TASK 3 — Premium Status Display in Account/Profile Section

**Goal:** Show the user their premium status, source label, and expiry date in the account/profile UI section.

Find the profile/account component and add this block where premium info is shown:

```jsx
import { isPremium, getPremiumLabel, getPremiumExpiry } from '../utils/premium';

// Inside your profile component:
const premiumActive = isPremium(profile);
const premiumLabel  = getPremiumLabel(profile);
const premiumExpiry = getPremiumExpiry(profile);

// JSX:
<div className="premium-status-block">
  {premiumActive ? (
    <div className="premium-badge active">
      <span>✅ Premium Active</span>
      <span className="premium-source">{premiumLabel}</span>
      {premiumExpiry && (
        <span className="premium-expiry">Expires: {premiumExpiry}</span>
      )}
    </div>
  ) : (
    <div className="premium-badge inactive">
      <span>🔒 Free Plan</span>
      {profile?.premium_expires_at && new Date(profile.premium_expires_at) < new Date() && (
        <span className="premium-expired">
          Your premium expired on {getPremiumExpiry(profile)}
        </span>
      )}
      <button onClick={openUpgradeModal}>Upgrade to Premium</button>
    </div>
  )}
</div>
```

---

## TASK 4 — Fix Paystack Webhook: Proper `premium_expires_at` Extension

**Goal:** When a new Paystack subscription payment arrives, calculate and store `premium_expires_at` correctly. If a user already has active premium (e.g., they renew early), extend from their existing expiry — not from today.

Open `api/paystack-webhook.js`. Find the section that handles `charge.success` or `subscription.create` and update the Supabase upsert:

```javascript
// api/paystack-webhook.js — inside the charge.success / subscription handler

const PLAN_DURATIONS = {
  [process.env.PAYSTACK_PLAN_MONTHLY]: 30,   // days
  [process.env.PAYSTACK_PLAN_YEARLY]:  365,  // days
};

async function handleSuccessfulPayment(data) {
  const email     = data.customer?.email;
  const planCode  = data.plan?.plan_code || data.metadata?.plan_code;
  const reference = data.reference;

  if (!email) return;

  const durationDays = PLAN_DURATIONS[planCode] ?? 30; // default to 30 days

  // 1. Fetch current profile to check existing expiry
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, premium, premium_expires_at')
    .eq('email', email)
    .single();

  // 2. Calculate new expiry — extend from current expiry if still active
  const now = new Date();
  const currentExpiry = profile?.premium_expires_at
    ? new Date(profile.premium_expires_at)
    : null;

  const baseDate = currentExpiry && currentExpiry > now ? currentExpiry : now;
  const newExpiry = new Date(baseDate);
  newExpiry.setDate(newExpiry.getDate() + durationDays);

  // 3. Upsert premium fields
  const { error } = await supabase
    .from('user_profiles')
    .update({
      premium:              true,
      premium_source:       'paystack',
      premium_activated_at: now.toISOString(),
      premium_expires_at:   newExpiry.toISOString(),
      paystack_reference:   reference,
      updated_at:           now.toISOString(),
    })
    .eq('email', email);

  if (error) {
    console.error('Webhook upsert error:', error);
    throw error;
  }

  console.log(`✅ Premium extended for ${email} until ${newExpiry.toISOString()}`);
}
```

**Also handle subscription cancellation / non-renewal** if you have a `subscription.disable` event:

```javascript
case 'subscription.disable': {
  const email = data.customer?.email;
  if (email) {
    await supabase
      .from('user_profiles')
      .update({
        premium:        false,
        premium_source: null,
        updated_at:     new Date().toISOString(),
      })
      .eq('email', email);
  }
  break;
}
```

---

## TASK 5 — Payslip Download Gate: Use `isPremium()`

Find the payslip download/generation function — the one that either stamps "SAMPLE" or allows a clean download. Replace the premium check:

```javascript
// ❌ OLD
if (!user.premium) { applyWatermark(); }

// ✅ NEW
import { isPremium } from '../utils/premium';
if (!isPremium(userProfile)) { applyWatermark(); }
```

This ensures expired users (after April 30) automatically get the watermark back without any additional code changes.

---

## TASK 6 — Upgrade Modal: Show Expiry-Aware Messaging

In your upgrade modal/prompt, add context for expired users:

```jsx
import { isPremium, getPremiumExpiry } from '../utils/premium';

// Inside upgrade modal:
const hasExpired = profile?.premium_expires_at &&
  new Date(profile.premium_expires_at) < new Date() &&
  !isPremium(profile);

const expiredOn = hasExpired ? getPremiumExpiry(profile) : null;

// In JSX:
{hasExpired && (
  <p style={{ color: '#e63946', marginBottom: '12px', fontSize: '14px' }}>
    ⚠️ Your premium access expired on <strong>{expiredOn}</strong>.
    Subscribe below to restore full access.
  </p>
)}
```

---

## TASK 7 — Environment Variables Check

Ensure these are set in Vercel dashboard and `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://wklhcmaodxatavuoduhd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
PAYSTACK_SECRET_KEY=<your-secret-key>
PAYSTACK_PLAN_MONTHLY=<monthly-plan-code>
PAYSTACK_PLAN_YEARLY=<yearly-plan-code>
```

---

## DEPLOYMENT CHECKLIST

- [ ] `isPremium()` utility created in `src/utils/premium.js`
- [ ] All old `profile.premium` boolean checks replaced with `isPremium(profile)`
- [ ] `EasterGiftBanner` mounted in main layout
- [ ] Profile/account section shows label + expiry date
- [ ] Paystack webhook calculates `premium_expires_at` with extension logic
- [ ] `subscription.disable` handler revokes premium
- [ ] Payslip download gate uses `isPremium()`
- [ ] Upgrade modal shows expiry-aware messaging
- [ ] Deployed to Vercel — push to `main` branch

---

## POST-APRIL 30 CLEANUP (Manual — run May 1)

In Supabase SQL Editor:

```sql
-- Revert Easter gift users
UPDATE public.user_profiles
SET
  premium            = FALSE,
  premium_source     = NULL,
  premium_expires_at = NULL
WHERE premium_source = 'easter_gift_2026';
```

> No code changes needed for this — once `premium_expires_at` passes, `isPremium()` already returns `false` automatically. This SQL just cleans up the flag for tidiness.
