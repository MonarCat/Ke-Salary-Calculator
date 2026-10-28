/**
 * /assets/js/ad-network-loader.js
 *
 * Monetag monetization — loaded ONLY for non-premium visitors.
 * (Adsterra stays retired; AdSense is unaffected and runs via its own meta tag.)
 *
 * Premium gating reuses the site's real logic (checkPremium in premium.js).
 *
 * FAIL-SAFE DIRECTION: if premium status cannot be determined (Supabase not
 * ready, auth error, profile row missing), Monetag is NOT loaded. A missed
 * impression is preferred over ever showing an ad to a paying subscriber.
 *
 * Premium users also get any lingering Monetag service worker (/sw.js)
 * unregistered, so push-style ads can't persist after an upgrade.
 *
 * Usage: ONE tag near the top of <head> on each included page:
 *   <script type="module" src="/assets/js/ad-network-loader.js?v=3.0"></script>
 * Bump the ?v= value whenever this file changes (cache-busting).
 */

import { checkPremium } from '/assets/js/premium.js';

const MONETAG_SRC = 'https://quge5.com/88/tag.min.js';
const MONETAG_ZONE = '219979';
const MONETAG_SMARTLINK = 'https://uplcm.com/4/10733671';

function injectScript(src, attrs = {}) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const s = document.createElement('script');
  s.src = src;
  s.async = true;
  s.setAttribute('data-ad-network', 'true');
  Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
  document.head.appendChild(s);
}

// supabase-config.js may load after this module; wait briefly for the client.
async function waitForClient(timeoutMs = 4000) {
  const start = Date.now();
  while (!window.supabaseClient && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 100));
  }
  return window.supabaseClient || null;
}

// Returns true when ads must NOT show (premium OR unknown).
async function shouldSuppressAds() {
  const client = await waitForClient();
  if (!client) return true;
  try {
    const status = await checkPremium(client);
    if (status.premiumCheckIndeterminate) return true;
    return !!status.isPremium;
  } catch (err) {
    console.warn('[ad-network-loader] Premium check failed — suppressing ads.', err);
    return true;
  }
}

async function unregisterMonetagServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      const scriptURL = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || '';
      if (scriptURL.endsWith('/sw.js')) await reg.unregister();
    }
  } catch (err) {
    console.warn('[ad-network-loader] Service worker cleanup failed (non-fatal).', err);
  }
}

// Clearly labelled sponsored link (Monetag SmartLink). Free users only; opens
// in a new tab on an explicit click. Never attached to calculator buttons.
function renderSponsoredLink() {
  if (document.getElementById('sc-sponsored-link')) return;
  const wrap = document.createElement('div');
  wrap.id = 'sc-sponsored-link';
  wrap.style.cssText = 'max-width:1080px;margin:1.5rem auto;padding:0 1rem;text-align:center;font-size:.85rem;';
  const label = document.createElement('span');
  label.textContent = 'Sponsored';
  label.style.cssText = 'text-transform:uppercase;letter-spacing:.08em;font-size:.68rem;opacity:.7;margin-right:.5rem;';
  const a = document.createElement('a');
  a.href = MONETAG_SMARTLINK;
  a.target = '_blank';
  a.rel = 'sponsored noopener noreferrer';
  a.textContent = 'Partner offer (opens in a new tab)';
  wrap.append(label, a);
  const footer = document.getElementById('site-footer');
  if (footer && footer.parentNode) footer.parentNode.insertBefore(wrap, footer);
  else document.body.appendChild(wrap);
}

async function init() {
  if (await shouldSuppressAds()) {
    unregisterMonetagServiceWorker();
    return;
  }
  injectScript(MONETAG_SRC, { 'data-zone': MONETAG_ZONE, 'data-cfasync': 'false' });
  renderSponsoredLink();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
