/**
 * /assets/js/calculator-enhancements.js
 *
 * Wires all enhancement modules on calculator.html.
 * Payment: Paystack (no PayPal).
 *
 * Add AFTER your existing calculator JS:
 *   <script type="module" src="/assets/js/calculator-enhancements.js"></script>
 *
 * Your calculator must dispatch this event when done:
 *   document.dispatchEvent(new CustomEvent('salaryCalculated', {
 *     detail: { gross, net, paye, nssf, shif, housing }
 *   }));
 */

import { checkPremium, gateFeature, invalidatePremiumCache } from "./premium.js";
import { initFinancialCards } from "./financial-tools.js";
import { renderShareCard }    from "./share-result.js";
import { initNewsletter }     from "./newsletter.js";
import { AdSlotManager }      from "./adslots.js";
import { createClient }       from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// ── Supabase client ───────────────────────────────────────────────────────────
// Remove this block if you already initialise supabase globally.
const SUPABASE_URL      = "https://wznopthjoaqusalqoyru.supabase.co";
const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY || "";
const supabase          = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const adManager = new AdSlotManager();

// ─────────────────────────────────────────────────────────────────────────────

async function initEnhancements() {
  const status = await checkPremium(supabase);
  const { isPremium, email } = status;

  // Expose user email globally — Paystack popup needs it
  if (email) window.__SC_USER_EMAIL = email;

  // ── 1. Ad slots (hidden for premium) ─────────────────────────────────────
  adManager.init(isPremium);

  // ── 2. Newsletter widget ──────────────────────────────────────────────────
  initNewsletter(supabase, "newsletter-widget-calc", { source: "calculator" });

  // ── 3. Financial affiliate cards ─────────────────────────────────────────
  initFinancialCards({ afterElementId: "salary-breakdown-table" });

  // ── 4. Share card on each calculation ────────────────────────────────────
  document.addEventListener("salaryCalculated", (e) => {
    const data = e.detail;
    renderShareCard("share-result-container", data, "salary-breakdown-table");
    const el = document.getElementById("share-result-container");
    if (el) el.style.display = "block";
  });

  // ── 5. Nav badge (Premium) ────────────────────────────────────────────────
  if (isPremium) {
    const nav = document.getElementById("nav-user-area");
    if (nav) {
      const badge = document.createElement("span");
      badge.className = "sc-premium-badge";
      badge.textContent = "⭐ Premium";
      Object.assign(badge.style, {
        background:   "#16a34a",
        color:        "#fff",
        fontSize:     "0.72rem",
        fontWeight:   "700",
        padding:      "2px 8px",
        borderRadius: "20px",
        marginLeft:   "6px",
      });
      nav.appendChild(badge);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initEnhancements);
} else {
  initEnhancements();
}
