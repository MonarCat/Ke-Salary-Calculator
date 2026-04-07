/**
 * /assets/js/easter-gift-banner.js
 *
 * Easter 2026 Holiday Gift Banner.
 *
 * Shows a warm, dismissible banner to users who have the Easter gift premium
 * (premium_source = 'easter_gift_2026').  Dismiss state is stored in
 * sessionStorage so the banner does not re-appear during the session.
 *
 * Usage:
 *   import { initEasterGiftBanner } from '/assets/js/easter-gift-banner.js';
 *   initEasterGiftBanner(supabase);   // call after DOMContentLoaded
 */

import { checkPremium, getPremiumExpiry } from "./premium.js";

const DISMISS_KEY = "easter_banner_dismissed";

/**
 * Create and inject the Easter banner above the first <div class="container">
 * found in the page, or directly at the top of <body> if none is found.
 *
 * @param {string|null} expiryStr  — formatted expiry string, e.g. "30 Apr 2026"
 */
function _injectBanner(expiryStr) {
  if (document.getElementById("sc-easter-banner")) return;

  const banner = document.createElement("div");
  banner.id = "sc-easter-banner";
  banner.setAttribute("role", "banner");
  banner.style.cssText = [
    "background:linear-gradient(135deg,#2D6A4F 0%,#40916C 100%)",
    "color:#fff",
    "padding:12px 20px",
    "display:flex",
    "align-items:center",
    "justify-content:space-between",
    "gap:12px",
    "font-size:14px",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif",
    "box-shadow:0 2px 8px rgba(0,0,0,0.15)",
    "position:relative",
    "z-index:1000",
    "flex-wrap:wrap",
  ].join(";");

  const expiryText = expiryStr ? ` until <strong>${expiryStr}</strong>` : "";
  banner.innerHTML = `
    <span style="flex:1;min-width:200px;">
      🐣 <strong>Easter Holiday Gift:</strong> You have full Premium access${expiryText}.
      Enjoy all features — from us to you! 🎉
    </span>
    <button
      id="sc-easter-banner-dismiss"
      aria-label="Dismiss Easter banner"
      style="
        background:transparent;
        border:1px solid rgba(255,255,255,0.5);
        color:#fff;
        border-radius:4px;
        padding:4px 10px;
        cursor:pointer;
        font-size:12px;
        white-space:nowrap;
        flex-shrink:0;
      "
    >Got it ✓</button>
  `;

  // Insert at top of <body> so it appears above all other content
  document.body.insertAdjacentElement("afterbegin", banner);

  document.getElementById("sc-easter-banner-dismiss").addEventListener("click", () => {
    sessionStorage.setItem(DISMISS_KEY, "true");
    banner.remove();
  });
}

/**
 * Initialise the Easter gift banner.
 * Call once per page — safe to call before or after DOMContentLoaded.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function initEasterGiftBanner(supabase) {
  // Already dismissed this session
  if (sessionStorage.getItem(DISMISS_KEY) === "true") return;

  // Wait for DOM
  await new Promise((resolve) => {
    if (document.readyState !== "loading") return resolve();
    document.addEventListener("DOMContentLoaded", resolve, { once: true });
  });

  const status = await checkPremium(supabase);

  // Only show for signed-in Easter gift users with active premium
  if (!status.isLoggedIn) return;
  if (!status.isPremium) return;
  if (status.premiumSource !== "easter_gift_2026") return;

  // Build a minimal profile-shaped object for getPremiumExpiry
  const expiryStr = getPremiumExpiry({ premium_expires_at: status.premiumExpiresAt });
  _injectBanner(expiryStr);
}
