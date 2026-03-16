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
import { initTrialBanner }    from "./trial-banner.js";
import { initFinancialCards } from "./financial-tools.js";
import { renderShareCard }    from "./share-result.js";
import { initNewsletter }     from "./newsletter.js";
import { AdSlotManager }      from "./adslots.js";
import { createClient }       from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// ── Supabase client ───────────────────────────────────────────────────────────
// Remove this block if you already initialise supabase globally.
const SUPABASE_URL      = "https://wklhcmaodxatavuoduhd.supabase.co";
const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY || "";
const supabase          = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const adManager = new AdSlotManager();

// ─────────────────────────────────────────────────────────────────────────────

async function initEnhancements() {
  const status = await checkPremium(supabase);
  const { isPremium, isTrial, email } = status;

  // Expose user email globally — Paystack popup needs it
  if (email) window.__SC_USER_EMAIL = email;

  // ── 1. Trial reminder banner ──────────────────────────────────────────────
  await initTrialBanner(supabase);

  // ── 2. Ad slots (hidden for premium) ─────────────────────────────────────
  adManager.init(isPremium);

  // ── 3. Gate PDF payslip behind premium ───────────────────────────────────
  const canDownloadPdf = await gateFeature(
    supabase,
    "payslip-pdf-section",
    "PDF Payslip Download is a Premium feature"
  );
  if (!canDownloadPdf) {
    document.getElementById("payslip-print-btn")?.setAttribute("disabled", "true");
  }

  // ── 4. Newsletter widget ──────────────────────────────────────────────────
  initNewsletter(supabase, "newsletter-widget-calc", { source: "calculator" });

  // ── 5. Financial affiliate cards ─────────────────────────────────────────
  initFinancialCards({ afterElementId: "salary-breakdown-table" });

  // ── 6. Share card on each calculation ────────────────────────────────────
  document.addEventListener("salaryCalculated", (e) => {
    const data = e.detail;
    renderShareCard("share-result-container", data, "salary-breakdown-table");
    const el = document.getElementById("share-result-container");
    if (el) el.style.display = "block";
  });

  // ── 7. Nav badge (Premium / Trial) ───────────────────────────────────────
  if (isPremium) {
    const nav = document.getElementById("nav-user-area");
    if (nav) {
      const badge = document.createElement("span");
      badge.className = "sc-premium-badge";
      badge.textContent = isTrial ? "✨ Trial" : "⭐ Premium";
      Object.assign(badge.style, {
        background:   isTrial ? "#0ea5e9" : "#16a34a",
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

// ─────────────────────────────────────────────────────────────────────────────
// HOW TO FIRE salaryCalculated from your existing calculator function:
// ─────────────────────────────────────────────────────────────────────────────
/*
  Add this ONE LINE at the end of your calculateSalary() function:

  document.dispatchEvent(new CustomEvent('salaryCalculated', {
    detail: {
      gross:   parseFloat(grossSalary),
      net:     parseFloat(netPay),
      paye:    parseFloat(payeAmount),
      nssf:    parseFloat(nssfAmount),
      shif:    parseFloat(shifAmount),
      housing: parseFloat(housingLevy),
    }
  }));
*/
