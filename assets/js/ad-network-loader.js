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
    if (status.premiumCheckIndeterminate !== false) return true;
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
