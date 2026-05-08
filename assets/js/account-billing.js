/**
 * /assets/js/account-billing.js
 *
 * Access status widget for account.html.
 * Renders into <div id="sc-billing-widget">.
 */

import {
  checkPremium,
  getPremiumLabel,
  getPremiumExpiry,
} from "./premium.js?v=20260507-1";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

let supabase;
if (window.supabaseClient) {
  supabase = window.supabaseClient;
} else {
  const supabaseUrl = window.__SUPABASE_URL  || "https://wznopthjoaqusalqoyru.supabase.co";
  const supabaseKey = window.__SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6bm9wdGhqb2FxdXNhbHFveXJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMTMxMzUsImV4cCI6MjA4NjU4OTEzNX0.dzShMzcDrvnI4amVPsfPYP8BCRVJUBKAm-HyUtIIbmk";
  supabase = createClient(supabaseUrl, supabaseKey);
}

function injectStyles() {
  if (document.getElementById("sc-ab-styles")) return;
  const s = document.createElement("style");
  s.id = "sc-ab-styles";
  s.textContent = `
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
      background: #dcfce7;
      color: #166534;
      border: 1px solid #bbf7d0;
    }
    .sc-ab-plan-name {
      font-size: 1.15rem;
      font-weight: 700;
      color: #0f172a;
    }
    [data-theme="dark"] .sc-ab-plan-name { color: #f1f5f9; }
    .sc-ab-expiry {
      font-size: 0.85rem;
      color: #475569;
      margin-top: 0.2rem;
    }
    [data-theme="dark"] .sc-ab-expiry { color: #94a3b8; }
    .sc-ab-features {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
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
    }
  `;
  document.head.appendChild(s);
}

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
  "Salary breakdown",
  "PAYE / NSSF / SHIF / HL",
  "Salary comparison",
  "Percentile ranking",
  "Gross-up calculator",
  "Share results (WhatsApp / X)",
  "Clean PDF payslip",
  "Employee management",
  "Bulk payslip generation",
  "Payroll analytics & reports",
  "KRA compliance reports",
  "Organization profile & branding",
  "Export payroll data (CSV / PDF)",
  "Saved history",
];

function render(status) {
  const widget = document.getElementById("sc-billing-widget");
  if (!widget) return;
  widget.innerHTML = "";

  if (!status.isLoggedIn) {
    widget.innerHTML = `
      <div class="sc-ab-card sc-ab-login-prompt">
        <p>Sign in to view your account access and saved data.</p>
        <a href="/auth" class="sc-ab-login-link">🔑 Sign In / Sign Up →</a>
      </div>`;
    return;
  }

  const legacySource = status.premiumSource
    ? `Legacy access source: ${_esc(getPremiumLabel({ premium_source: status.premiumSource }))}`
    : "All features are now available at no cost.";

  const legacyExpiry = status.premiumExpiresAt
    ? `Legacy expiry date on record: ${_esc(getPremiumExpiry({ premium_expires_at: status.premiumExpiresAt }))}`
    : "";

  const featureItems = FEATURES.map((label) => (
    `<li><span>✅</span>${_esc(label)}</li>`
  )).join("");

  widget.innerHTML = `
    <div class="sc-ab-card">
      <div class="sc-ab-plan-row">
        <span class="sc-ab-badge">✅ Free Access</span>
        <span class="sc-ab-plan-name">All Features Enabled</span>
      </div>
      <p class="sc-ab-expiry">${legacySource}</p>
      ${legacyExpiry ? `<p class="sc-ab-expiry">${legacyExpiry}</p>` : ""}
    </div>

    <div class="sc-ab-card">
      <h3 style="font-size:0.82rem;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 0.75rem;">Your Features</h3>
      <ul class="sc-ab-features">${featureItems}</ul>
    </div>`;
}

async function init() {
  injectStyles();

  const widget = document.getElementById("sc-billing-widget");
  if (!widget) return;

  widget.innerHTML = `<div class="sc-ab-loading">⏳ Loading your account access…</div>`;

  const status = await checkPremium(supabase);
  if (status.email) window.__SC_USER_EMAIL = status.email;

  render(status);
}

document.addEventListener("DOMContentLoaded", init);
