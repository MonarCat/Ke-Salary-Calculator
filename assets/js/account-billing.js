/**
 * /assets/js/account-billing.js
 *
 * Plan status widget + upgrade button for account.html.
 * Renders into <div id="sc-billing-widget">.
 *
 * Shows:
 *  - Current plan badge: Free / Premium
 *  - Feature list (locked/unlocked per tier)
 *  - Always-visible upgrade section with monthly/yearly selector
 *  - Pay button that opens Paystack popup directly
 *
 * The widget re-renders itself after a successful payment to reflect
 * the updated plan status.
 *
 * Usage (account.html):
 *   <div id="sc-billing-widget"></div>
 *   <script type="module" src="/assets/js/account-billing.js?v=20260507-1"></script>
 */

import {
  checkPremium,
  openPaystackCheckout,
  invalidatePremiumCache,
  getPremiumLabel,
  getPremiumExpiry,
  PRICE_MONTHLY_KES,
  PRICE_YEARLY_KES,
  PRICE_SAVINGS_KES,
} from "./premium.js?v=20260507-1";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// ── Supabase client ───────────────────────────────────────────────────────────
// Re-use the global client from supabase-config.js when available, so both
// scripts authenticate against the same Supabase project.

let supabase;
if (window.supabaseClient) {
  supabase = window.supabaseClient;
} else {
  const supabaseUrl = window.__SUPABASE_URL  || "https://wklhcmaodxatavuoduhd.supabase.co";
  const supabaseKey = window.__SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6bm9wdGhqb2FxdXNhbHFveXJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMTMxMzUsImV4cCI6MjA4NjU4OTEzNX0.dzShMzcDrvnI4amVPsfPYP8BCRVJUBKAm-HyUtIIbmk";
 
  supabase = createClient(supabaseUrl, supabaseKey);
}

// ── Styles ────────────────────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById("sc-ab-styles")) return;
  const s = document.createElement("style");
  s.id = "sc-ab-styles";
  s.textContent = `
    /* ── Billing widget container ── */
    #sc-billing-widget {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      max-width: 680px;
      margin: 0 auto;
    }

    .sc-ab-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 1.5rem;
      margin-bottom: 1.25rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }

    [data-theme="dark"] .sc-ab-card {
      background: #1e293b;
      border-color: #334155;
    }

    /* ── Plan badge row ── */
    .sc-ab-plan-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-bottom: 0.5rem;
    }

    .sc-ab-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.8rem;
      font-weight: 700;
      padding: 0.25rem 0.85rem;
      border-radius: 20px;
    }

    .sc-ab-badge--free     { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
    .sc-ab-badge--trial    { background: #fef9c3; color: #854d0e; border: 1px solid #fde68a; }
    .sc-ab-badge--premium  { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .sc-ab-badge--expired  { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }

    .sc-ab-plan-name {
      font-size: 1.15rem;
      font-weight: 700;
      color: #0f172a;
    }
    [data-theme="dark"] .sc-ab-plan-name { color: #f1f5f9; }

    .sc-ab-expiry {
      font-size: 0.82rem;
      color: #475569;
      margin-top: 0.2rem;
    }
    [data-theme="dark"] .sc-ab-expiry { color: #94a3b8; }

    .sc-ab-source {
      font-size: 0.8rem;
      font-weight: 600;
      color: #166534;
      background: #dcfce7;
      border-radius: 12px;
      padding: 1px 8px;
      display: inline-block;
    }
    [data-theme="dark"] .sc-ab-source { background: #14532d; color: #86efac; }

    /* ── Trial progress bar ── */
    .sc-ab-trial-bar {
      margin: 1rem 0 0;
    }

    .sc-ab-trial-bar__label {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      color: #475569;
      margin-bottom: 0.3rem;
    }
    [data-theme="dark"] .sc-ab-trial-bar__label { color: #94a3b8; }

    .sc-ab-trial-bar__track {
      height: 8px;
      background: #e2e8f0;
      border-radius: 99px;
      overflow: hidden;
    }

    .sc-ab-trial-bar__fill {
      height: 100%;
      border-radius: 99px;
      transition: width 0.6s ease;
      background: #16a34a;
    }

    .sc-ab-trial-bar__fill--warning { background: #f59e0b; }
    .sc-ab-trial-bar__fill--danger  { background: #dc2626; }

    /* ── Feature list ── */
    .sc-ab-features {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 0.4rem 1rem;
    }

    .sc-ab-features li {
      font-size: 0.88rem;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    [data-theme="dark"] .sc-ab-features li { color: #e2e8f0; }

    .sc-ab-features li.locked {
      color: #94a3b8;
      text-decoration: line-through;
    }

    .sc-ab-features li .sc-ab-feat-icon { flex-shrink: 0; font-size: 0.9rem; }

    /* ── Upgrade section ── */
    .sc-ab-upgrade-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 0.75rem;
    }
    [data-theme="dark"] .sc-ab-upgrade-title { color: #f1f5f9; }

    .sc-ab-plan-toggle {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }

    .sc-ab-plan-option {
      flex: 1;
      min-width: 140px;
      border: 2px solid #e2e8f0;
      border-radius: 10px;
      padding: 0.75rem 1rem;
      cursor: pointer;
      background: #fff;
      text-align: center;
      transition: border-color 0.15s, box-shadow 0.15s;
      position: relative;
    }

    [data-theme="dark"] .sc-ab-plan-option {
      background: #1e293b;
      border-color: #334155;
    }

    .sc-ab-plan-option.selected {
      border-color: #16a34a;
      box-shadow: 0 0 0 3px rgba(22,163,74,0.15);
    }

    .sc-ab-plan-option__badge {
      position: absolute;
      top: -10px;
      right: 10px;
      background: #16a34a;
      color: #fff;
      font-size: 0.68rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 20px;
    }

    .sc-ab-plan-option__label {
      display: block;
      font-size: 0.8rem;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 0.2rem;
    }

    .sc-ab-plan-option__price {
      display: block;
      font-size: 1.35rem;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.1;
    }

    [data-theme="dark"] .sc-ab-plan-option__price { color: #f1f5f9; }

    .sc-ab-plan-option__period {
      display: block;
      font-size: 0.76rem;
      color: #64748b;
      margin-top: 0.15rem;
    }

    .sc-ab-plan-option__saving {
      display: block;
      font-size: 0.75rem;
      color: #16a34a;
      font-weight: 600;
      margin-top: 0.2rem;
    }

    .sc-ab-pay-btn {
      display: flex;
      width: 100%;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.9rem 1.5rem;
      background: #16a34a;
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.15s, transform 0.15s;
      min-height: 48px;
      touch-action: manipulation;
    }

    .sc-ab-pay-btn:hover  { background: #15803d; transform: translateY(-1px); }
    .sc-ab-pay-btn:active { transform: translateY(0); }
    .sc-ab-pay-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

    .sc-ab-pay-note {
      text-align: center;
      font-size: 0.76rem;
      color: #64748b;
      margin-top: 0.6rem;
    }

    /* ── Loading / auth states ── */
    .sc-ab-loading {
      text-align: center;
      padding: 2.5rem 1rem;
      color: #475569;
      font-size: 0.9rem;
    }

    .sc-ab-login-prompt {
      text-align: center;
      padding: 2rem 1rem;
    }

    .sc-ab-login-prompt p {
      color: #475569;
      margin-bottom: 1rem;
    }

    .sc-ab-login-link {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.7rem 1.5rem;
      background: #16a34a;
      color: #fff;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.9rem;
      transition: background 0.15s;
    }

    .sc-ab-login-link:hover { background: #15803d; }

    /* ── Responsive ── */
    @media (max-width: 480px) {
      .sc-ab-card { padding: 1.1rem; }
      .sc-ab-plan-option { min-width: 120px; padding: 0.6rem 0.75rem; }
      .sc-ab-plan-option__price { font-size: 1.15rem; }
    }
  `;
  document.head.appendChild(s);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const FEATURES = [
  // Free features
  { label: "Salary breakdown",              free: true  },
  { label: "PAYE / NSSF / SHIF / HL",      free: true  },
  { label: "Salary comparison",             free: true  },
  { label: "Percentile ranking",            free: true  },
  { label: "Gross-up calculator",           free: true  },
  { label: "Share results (WhatsApp / X)",  free: true  },
  { label: "Watermarked SAMPLE payslip",    free: true  },
  { label: "Up to 2 employees",             free: true  },
  { label: "2 payslip downloads / month",   free: true  },
  // Premium features
  { label: "Clean PDF payslip (no watermark)", free: false },
  { label: "Unlimited employees",              free: false },
  { label: "Unlimited payslip downloads",      free: false },
  { label: "Bulk payslip generation",          free: false },
  { label: "Full payroll history",             free: false },
  { label: "Payroll analytics & reports",      free: false },
  { label: "KRA compliance reports",           free: false },
  { label: "Organization profile & branding",  free: false },
  { label: "Multiple department management",   free: false },
  { label: "Export payroll data (CSV / PDF)",  free: false },
  { label: "Ad-free experience",               free: false },
  { label: "Priority support",                 free: false },
];

function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" });
}

// ── Render ────────────────────────────────────────────────────────────────────

function render(status) {
  const widget = document.getElementById("sc-billing-widget");
  if (!widget) return;
  widget.innerHTML = "";

  if (!status.isLoggedIn) {
    widget.innerHTML = `
      <div class="sc-ab-card sc-ab-login-prompt">
        <p>Sign in to view your plan status and manage your subscription.</p>
        <a href="/auth" class="sc-ab-login-link">🔑 Sign In / Sign Up →</a>
      </div>`;
    return;
  }

  // ── Plan status card ──────────────────────────────────────────────────────
  let badgeClass, badgeLabel, planName, expiryLine;

  if (status.isPremium) {
    const sourceLabel = getPremiumLabel({ premium_source: status.premiumSource });
    const expiryLabel = getPremiumExpiry({ premium_expires_at: status.premiumExpiresAt });
    badgeClass  = "sc-ab-badge--premium";
    badgeLabel  = "⭐ Premium";
    planName    = "Premium Plan";
    expiryLine  = expiryLabel
      ? `<span class="sc-ab-source">${_esc(sourceLabel)}</span> &nbsp;·&nbsp; Expires: ${_esc(expiryLabel)}`
      : `<span class="sc-ab-source">${_esc(sourceLabel)}</span> &nbsp;·&nbsp; Active — no expiry set`;
  } else {
    const profileExpiresAt = status.premiumExpiresAt;
    const hasExpired = profileExpiresAt && new Date(profileExpiresAt) < new Date();
    const expiredOn  = hasExpired ? getPremiumExpiry({ premium_expires_at: profileExpiresAt }) : null;
    badgeClass  = "sc-ab-badge--free";
    badgeLabel  = "Free";
    planName    = "Free Plan";
    expiryLine  = hasExpired
      ? `⚠️ Your premium expired on <strong>${_esc(expiredOn)}</strong>. Subscribe below to restore access.`
      : "Upgrade to unlock all features.";
  }

  const planCardHtml = `
    <div class="sc-ab-card">
      <div class="sc-ab-plan-row">
        <span class="sc-ab-badge ${badgeClass}">${badgeLabel}</span>
        <span class="sc-ab-plan-name">${planName}</span>
      </div>
      <p class="sc-ab-expiry">${expiryLine}</p>
    </div>`;

  // ── Feature list card ─────────────────────────────────────────────────────
  const hasAccess = status.isPremium;
  const featureItems = FEATURES.map((f) => {
    const unlocked = f.free || hasAccess;
    const icon     = unlocked ? "✅" : "🔒";
    const cls      = unlocked ? "" : "locked";
    return `<li class="${cls}"><span class="sc-ab-feat-icon">${icon}</span>${f.label}</li>`;
  }).join("");

  const featuresCardHtml = `
    <div class="sc-ab-card">
      <h3 style="font-size:0.82rem;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 0.75rem;">Your Features</h3>
      <ul class="sc-ab-features">${featureItems}</ul>
    </div>`;

  // ── Upgrade card (always visible) ─────────────────────────────────────────
  let selectedPlan = "yearly"; // default selection

  const upgradeCardHtml = `
    <div class="sc-ab-card" id="sc-ab-upgrade-card">
      <p class="sc-ab-upgrade-title">
        ${status.isPremium
          ? "🔄 Extend or Change Your Plan"
          : "⬆️ Upgrade to Premium"
        }
      </p>

      <div class="sc-ab-plan-toggle" id="sc-ab-toggle">
        <div class="sc-ab-plan-option selected" data-plan="yearly" tabindex="0" role="button" aria-pressed="true">
          <span class="sc-ab-plan-option__badge">Best Value</span>
          <span class="sc-ab-plan-option__label">Yearly</span>
          <span class="sc-ab-plan-option__price">KES ${PRICE_YEARLY_KES.toLocaleString()}</span>
          <span class="sc-ab-plan-option__period">per year</span>
          <span class="sc-ab-plan-option__saving">Save KES ${PRICE_SAVINGS_KES.toLocaleString()}</span>
        </div>
        <div class="sc-ab-plan-option" data-plan="monthly" tabindex="0" role="button" aria-pressed="false">
          <span class="sc-ab-plan-option__label">Monthly</span>
          <span class="sc-ab-plan-option__price">KES ${PRICE_MONTHLY_KES.toLocaleString()}</span>
          <span class="sc-ab-plan-option__period">per month</span>
        </div>
      </div>

      <button class="sc-ab-pay-btn" id="sc-ab-pay-btn">
        💳 Pay with M-Pesa / Card
      </button>
      <p class="sc-ab-pay-note">Secure payment via Paystack &nbsp;·&nbsp; M-Pesa, Visa, Mastercard</p>
    </div>`;

  widget.innerHTML = planCardHtml + featuresCardHtml + upgradeCardHtml;

  // ── Wire up plan toggle ───────────────────────────────────────────────────
  const toggle  = widget.querySelector("#sc-ab-toggle");
  const payBtn  = widget.querySelector("#sc-ab-pay-btn");

  toggle?.querySelectorAll(".sc-ab-plan-option").forEach((opt) => {
    function selectOption() {
      toggle.querySelectorAll(".sc-ab-plan-option").forEach((o) => {
        o.classList.remove("selected");
        o.setAttribute("aria-pressed", "false");
      });
      opt.classList.add("selected");
      opt.setAttribute("aria-pressed", "true");
      selectedPlan = opt.dataset.plan;
    }
    opt.addEventListener("click",   selectOption);
    opt.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectOption(); } });
  });

  // ── Wire up pay button ────────────────────────────────────────────────────
  payBtn?.addEventListener("click", async () => {
    const email = status.email || window.__SC_USER_EMAIL;
    if (!email) {
      // Import lazily to avoid circular dep issues
      const { showEmailCapture } = await import("./premium.js?v=20260507-1");
      showEmailCapture(selectedPlan, (captured) => {
        _launchPaystack(captured, selectedPlan, status);
      });
      return;
    }
    _launchPaystack(email, selectedPlan, status);
  });
}

function _launchPaystack(email, plan, currentStatus) {
  const payBtn = document.querySelector("#sc-ab-pay-btn");
  if (payBtn) {
    payBtn.disabled = true;
    payBtn.textContent = "Opening payment…";
  }

  openPaystackCheckout({
    plan,
    email,
    onSuccess: async () => {
      invalidatePremiumCache();
      // Re-fetch and re-render the widget with updated status
      const updated = await checkPremium(supabase);
      render(updated);
      // Redirect to thank-you page
      window.location.href = "/premium-thank-you";
    },
    onClose: () => {
      if (payBtn) {
        payBtn.disabled = false;
        payBtn.innerHTML = "💳 Pay with M-Pesa / Card";
      }
    },
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  injectStyles();

  const widget = document.getElementById("sc-billing-widget");
  if (!widget) return;

  widget.innerHTML = `<div class="sc-ab-loading">⏳ Loading your plan status…</div>`;

  const status = await checkPremium(supabase);

  // Expose email globally so Paystack gate can use it
  if (status.email) window.__SC_USER_EMAIL = status.email;

  render(status);
}

document.addEventListener("DOMContentLoaded", init);
