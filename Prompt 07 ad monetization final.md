# salarycalculator.co.ke — Ad Monetization: Monetag + Adsterra
## Copilot Implementation Prompt (single pass)

---

## 🔒 DO NOT MODIFY (unrelated, protected billing files)
```
api/paystack-intent.js
api/paystack-verify.js
api/paystack-webhook.js
api/paystack-donation-verify.js
assets/js/premium.js          ← imported/read only, never edited
assets/js/account-billing.js
assets/js/donate.js
assets/js/plan-features.js
supabase/migrations/**
vercel.json
```
After finishing, run `git diff --stat` and confirm none of these appear.

---

## Step 1 — Replace `ads.txt` at the repo root

```
google.com, pub-6832553346534070, DIRECT, f08c47fec0942fa0
monetag.com, 3264328, DIRECT
adsterra.com, 3442055, DIRECT
```

## Step 2 — Add `sw.js` at the repo root (next to `index.html`)

```javascript
self.options = {
    "domain": "5gvci.com",
    "zoneId": 10733493
}
self.lary = ""
importScripts('https://5gvci.com/act/files/service-worker.min.js?r=sw')
```

Do not modify this content — `domain`/`zoneId` are Monetag's real account identifiers.
No existing service worker or registration code exists on the site currently, so
there is no conflict to merge.

## Step 3 — Add `assets/js/ad-network-loader.js`

```javascript
/**
 * /assets/js/ad-network-loader.js
 *
 * Loads Monetag + Adsterra (Popunder, Social Bar) — but ONLY for non-premium
 * users. Reuses the site's real premium-detection logic from premium.js
 * (checkPremium) rather than re-implementing it, so this stays correct if
 * premium rules ever change there.
 *
 * FAIL-SAFE DIRECTION: if premium status cannot be determined for any reason
 * (Supabase unreachable, not yet initialized, etc.), this loader defaults to
 * HIDING these ads, not showing them — the opposite of adsense-config.js's
 * fail-open behavior. This is deliberate: Popunder/Social Bar are intrusive
 * formats, and "never show on premium" was an explicit hard requirement, so
 * an occasional missed impression is preferred over any chance of showing
 * one to a paying user.
 *
 * Also handles the Monetag service worker (/sw.js): if a user upgraded to
 * premium AFTER previously browsing as a free user, their browser may still
 * have that worker registered from before. On every load where the user IS
 * premium, this proactively unregisters it so push-notification ads can't
 * linger for an upgraded account.
 *
 * Usage: add ONE tag near the top of <head> on each included page:
 *   <script type="module" src="/assets/js/ad-network-loader.js"></script>
 */

import { checkPremium } from '/assets/js/premium.js';

const MONETAG_SRC = 'https://quge5.com/88/tag.min.js';
const MONETAG_ZONE = '219979';

const ADSTERRA_SOCIAL_BAR_SRC =
  'https://pl31006733.profitableratecpmnetwork.com/00/0a/d4/000ad40edba9fa9e4ac851d05cacbd80.js';

const ADSTERRA_POPUNDER_SRC =
  'https://pl31006734.profitableratecpmnetwork.com/49/d4/d7/49d4d7f487c5f99d581e975d359fe7ea.js';

function scriptAlreadyPresent(src) {
  return !!document.querySelector(`script[src="${src}"]`);
}

function injectScript(src, { target = document.head, attrs = {} } = {}) {
  if (scriptAlreadyPresent(src)) return;
  const s = document.createElement('script');
  s.src = src;
  s.async = true;
  s.setAttribute('data-ad-network', 'true');
  Object.entries(attrs).forEach(([key, value]) => s.setAttribute(key, value));
  target.appendChild(s);
}

async function resolvePremiumStatus() {
  const client = window.supabaseClient;
  if (!client) {
    console.warn('[ad-network-loader] No Supabase client on window — defaulting to NOT showing third-party ads.');
    return true; // fail-safe: treat as premium (i.e. hide) when we can't check
  }
  try {
    const status = await checkPremium(client);
    return !!status.isPremium;
  } catch (err) {
    console.warn('[ad-network-loader] Premium check failed — defaulting to NOT showing third-party ads.', err);
    return true; // fail-safe: hide on error
  }
}

async function unregisterMonetagServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      const scriptURL = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || '';
      if (scriptURL.endsWith('/sw.js')) {
        await reg.unregister();
        console.log('[ad-network-loader] Premium user — unregistered lingering Monetag service worker.');
      }
    }
  } catch (err) {
    console.warn('[ad-network-loader] Service worker cleanup check failed (non-fatal).', err);
  }
}

async function initThirdPartyAds() {
  const isPremium = await resolvePremiumStatus();

  if (isPremium) {
    console.log('[ad-network-loader] Premium user — Monetag/Adsterra will not load.');
    unregisterMonetagServiceWorker();
    return;
  }

  // Monetag
  injectScript(MONETAG_SRC, {
    target: document.head,
    attrs: { 'data-zone': MONETAG_ZONE, 'data-cfasync': 'false' },
  });

  // Adsterra Popunder — one per page, guarded by scriptAlreadyPresent above
  injectScript(ADSTERRA_POPUNDER_SRC, { target: document.head });

  // Adsterra Social Bar — network renders its own fixed-position UI via JS,
  // so document.body vs document.head placement doesn't change what the
  // user sees; appended to body to stay close to the requested spec.
  injectScript(ADSTERRA_SOCIAL_BAR_SRC, { target: document.body });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initThirdPartyAds);
} else {
  initThirdPartyAds();
}
```

## Step 4 — Add the loader tag to included pages only

Add immediately after the opening `<head>` tag:

```html
<script type="module" src="/assets/js/ad-network-loader.js"></script>
```

**Include (all public content/tool pages):**
```
index.html, calculator.html, about-us.html, contact-us.html, faq.html,
blog.html, blog-post.html, salary-news.html, salary-index.html,
salary-comparison.html, salary-raise-calculator.html, salary-guess-game.html,
salary-after-tax.html, reverse-salary-calculator.html,
global-salary-calculator.html, paye-calculator-kenya.html,
statutory-deductions-kenya.html, payslip-generator-kenya.html,
budget-planner.html, budget-history.html, cost-of-living-nairobi-2025.html,
how-paye-is-calculated-kenya-2026.html, how-to-negotiate-salary-kenya-2025.html,
kenya-affordable-housing-levy-explained.html, kenya-tax-abolition-below-30000.html,
nssf-tier-i-vs-tier-ii-kenya.html, shif-vs-nhif-kenya-2024.html,
understanding-your-kenyan-payslip.html, what-is-shif-levy-kenya.html,
external-links.html, donate.html, premium-thank-you.html,
privacy-policy.html, terms-of-service.html, cookie-policy.html,
25000.html, 30000.html, 35000.html, 40000.html, 45000.html, 50000.html,
55000.html, 60000.html, 65000.html, 70000.html, 75000.html, 80000.html,
85000.html, 90000.html, 95000.html, 100000.html, 110000.html, 120000.html,
130000.html, 140000.html, 150000.html, 160000.html, 170000.html, 180000.html,
190000.html, 200000.html, 250000.html, 300000.html
```

**Exclude (do not add the tag):**
```
admin.html, admin-auth.html          → internal admin dashboard
auth.html, reset-password.html       → sign-in/sign-up flow, bad UX + no upside
account.html, profile.html,
employees.html, payroll-history.html,
payroll-report.html, payroll-import.html,
p9a-generator.html, organisation-profile.html
                                       → money/billing-adjacent pages, Paystack
                                         checkout renders here
adsense-example.html                 → should already be removed (Session 6)
```

---

## Verification checklist

1. **Logged out / free user:** on 3-4 included pages, DevTools Network tab shows
   requests to `quge5.com/88/tag.min.js` and both
   `...profitableratecpmnetwork.com/...` URLs.
2. **Premium user:** same pages, zero requests to those three domains; console
   logs `"Premium user — Monetag/Adsterra will not load."`
3. **Upgraded user (was free, now premium):** confirm console logs the service
   worker unregister message and no push-related requests fire afterward.
4. **Excluded pages, especially `account.html`:** confirm a full test-mode Paystack
   purchase still completes with no console errors — this change should not have
   touched that flow at all.
5. **`https://salarycalculator.co.ke/ads.txt`** and **`https://salarycalculator.co.ke/sw.js`**
   resolve correctly after deploy.
