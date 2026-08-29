/**
 * /assets/js/ad-network-loader.js
 *
 * RETIRED — Monetag and Adsterra (Popunder, Social Bar) have been
 * completely removed. Their loading code (URLs, zone IDs, injectScript
 * calls, premium-gating logic) is deleted entirely, not just paused behind
 * a flag. The previous PAUSE_THIRD_PARTY_ADS flag turned out to be
 * unreliable in practice: this exact file had no cache-busting version
 * string, so browsers/CDN edges that fetched it before the flag was set
 * to true kept serving an older cached copy that still loaded both
 * networks regardless of the flag's current value.
 *
 * Google AdSense is unaffected by this file and continues via the
 * `google-adsense-account` meta tag already present on each page.
 *
 * This file is kept in place (rather than removing the <script> tag from
 * the 63 pages that reference it) purely to run one remaining task: clean
 * up any Monetag service worker (/sw.js) still lingering in a visitor's
 * browser from before removal, so push-notification-style ads can't
 * persist for anyone who visited while Monetag was active.
 *
 * Usage: add ONE tag near the top of <head> on each included page:
 *   <script type="module" src="/assets/js/ad-network-loader.js"></script>
 */

async function unregisterMonetagServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      const scriptURL = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || '';
      if (scriptURL.endsWith('/sw.js')) {
        await reg.unregister();
        console.log('[ad-network-loader] Unregistered lingering Monetag service worker.');
      }
    }
  } catch (err) {
    console.warn('[ad-network-loader] Service worker cleanup check failed (non-fatal).', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', unregisterMonetagServiceWorker);
} else {
  unregisterMonetagServiceWorker();
}
