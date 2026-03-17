/**
 * /assets/js/account-billing.js
 *
 * Plan status widget for account.html.
 * Renders into <div id="sc-billing-widget">.
 *
 * Shows:
 *  - Current plan badge: Free / Organisation Trial / Premium
 *  - Trial countdown bar (if on trial)
 *  - Feature list (locked/unlocked per tier)
 *  - Always-visible upgrade section with monthly/yearly selector
 *  - Pay button that opens Paystack popup directly
 *
 * Re-renders itself after a successful payment to reflect the updated plan.
 *
 * Usage in account.html:
 *   <div id="sc-billing-widget"></div>
 *   <script type="module" src="/assets/js/account-billing.js"></script>
 */

import { createClient }         from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import {
  checkPremium,
  openPaystackCheckout,
  invalidatePremiumCache,
  showEmailCapture,
  PRICE_MONTHLY_KES,
  PRICE_YEARLY_KES,
  PRICE_SAVINGS_KES,
} from "/assets/js/premium.js";

// ── Supabase client ───────────────────────────────────────────────────────────

const supabase = createClient(
  window.__SUPABASE_URL      || "https://wznopthjoaqusalqoyru.supabase.co",
  window.__SUPABASE_ANON_KEY || ""
);

// ── Styles (injected once) ────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById("sc-ab-styles")) return;
  const s = document.createElement("style");
  s.id = "sc-ab-styles";
  s.textContent = `
    #sc-billing-widget {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      max-width: 720px;
      margin: 0 auto;
    }

    /* ── Plan card ───────────────────────────────────────────────────────── */
    .sc-ab-plan-card {
      background: #fff;
      border: 1.5px solid #e2e8f0;
      border-radius: 14px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    [data-theme="dark"] .sc-ab-plan-card {
      background: #1e293b;
      border-color: #334155;
    }

    .sc-ab-plan-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 16px;
    }

    .sc-ab-plan-label {
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
    }
    [data-theme="dark"] .sc-ab-plan-label { color: #94a3b8; }

    /* Badges */
    .sc-ab-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 14px;
      border-radius: 20px;
      font-size: 0.82rem;
      font-weight: 700;
    }
    .sc-ab-badge--free    { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }
    .sc-ab-badge--trial   { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; }
    .sc-ab-badge--premium { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }

    .sc-ab-expiry {
      font-size: 0.83rem;
      color: #64748b;
      margin-top: 4px;
    }
    [data-theme="dark"] .sc-ab-expiry { color: #94a3b8; }

    /* ── Trial countdown bar ─────────────────────────────────────────────── */
    .sc-ab-trial-bar {
      margin-top: 14px;
    }
    .sc-ab-trial-bar__label {
      display: flex;
      justify-content: space-between;
      font-size: 0.78rem;
      color: #64748b;
      margin-bottom: 5px;
    }
    [data-theme="dark"] .sc-ab-trial-bar__label { color: #94a3b8; }
    .sc-ab-trial-bar__track {
      height: 8px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
    }
    [data-theme="dark"] .sc-ab-trial-bar__track { background: #334155; }
    .sc-ab-trial-bar__fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.4s ease;
    }
    .sc-ab-trial-bar__fill--ok      { background: #22c55e; }
    .sc-ab-trial-bar__fill--warning { background: #f59e0b; }
    .sc-ab-trial-bar__fill--danger  { background: #ef4444; }

    /* ── Features list ───────────────────────────────────────────────────── */
    .sc-ab-features {
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 20px;
    }
    [data-theme="dark"] .sc-ab-features {
      background: #1e293b;
      border-color: #334155;
    }
    .sc-ab-features__title {
      font-size: 0.82rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin-bottom: 12px;
    }
    [data-theme="dark"] .sc-ab-features__title { color: #94a3b8; }
    .sc-ab-features__list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 8px;
    }
    .sc-ab-features__item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.88rem;
    }
    .sc-ab-features__item--locked { color: #94a3b8; }
    [data-theme="dark"] .sc-ab-features__item { color: #e2e8f0; }
    [data-theme="dark"] .sc-ab-features__item--locked { color: #475569; }
    .sc-ab-features__icon { font-size: 1rem; flex-shrink: 0; width: 20px; text-align: center; }

    /* ── Upgrade card ────────────────────────────────────────────────────── */
    .sc-ab-upgrade {
      background: #fff;
      border: 1.5px solid #e2e8f0;
      border-radius: 14px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    [data-theme="dark"] .sc-ab-upgrade {
      background: #1e293b;
      border-color: #334155;
    }
    .sc-ab-upgrade__title {
      font-size: 1.05rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 4px;
    }
    [data-theme="dark"] .sc-ab-upgrade__title { color: #f1f5f9; }
    .sc-ab-upgrade__sub {
      font-size: 0.85rem;
      color: #64748b;
      margin: 0 0 18px;
    }
    [data-theme="dark"] .sc-ab-upgrade__sub { color: #94a3b8; }

    /* Plan toggle */
    .sc-ab-plan-toggle {
      display: flex;
      gap: 8px;
      margin-bottom: 18px;
      flex-wrap: wrap;
    }
    .sc-ab-plan-toggle__btn {
      flex: 1;
      min-width: 120px;
      padding: 12px 16px;
      border: 2px solid #e2e8f0;
      border-radius: 10px;
      background: #fff;
      cursor: pointer;
      text-align: center;
      transition: all 0.15s;
    }
    [data-theme="dark"] .sc-ab-plan-toggle__btn {
      background: #0f172a;
      border-color: #334155;
      color: #e2e8f0;
    }
    .sc-ab-plan-toggle__btn.active {
      border-color: #16a34a;
      box-shadow: 0 0 0 2px #dcfce7;
    }
    [data-theme="dark"] .sc-ab-plan-toggle__btn.active {
      border-color: #22c55e;
      box-shadow: 0 0 0 2px rgba(34,197,94,0.2);
    }
    .sc-ab-plan-toggle__name {
      display: block;
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #64748b;
      margin-bottom: 2px;
    }
    .sc-ab-plan-toggle__btn.active .sc-ab-plan-toggle__name { color: #15803d; }
    [data-theme="dark"] .sc-ab-plan-toggle__btn.active .sc-ab-plan-toggle__name { color: #22c55e; }
    .sc-ab-plan-toggle__price {
      display: block;
      font-size: 1.25rem;
      font-weight: 800;
      color: #0f172a;
    }
    [data-theme="dark"] .sc-ab-plan-toggle__price { color: #f1f5f9; }
    .sc-ab-plan-toggle__period {
      display: block;
      font-size: 0.72rem;
      color: #64748b;
    }
    [data-theme="dark"] .sc-ab-plan-toggle__period { color: #94a3b8; }
    .sc-ab-plan-toggle__saving {
      display: inline-block;
      background: #dcfce7;
      color: #15803d;
      font-size: 0.68rem;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: 10px;
      margin-top: 3px;
    }
    .sc-ab-plan-toggle__badge {
      display: inline-block;
      background: #16a34a;
      color: #fff;
      font-size: 0.65rem;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: 10px;
      margin-bottom: 4px;
    }

    /* Pay button */
    .sc-ab-pay-btn {
      width: 100%;
      padding: 14px 20px;
      background: #16a34a;
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.15s, transform 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 50px;
    }
    .sc-ab-pay-btn:hover { background: #15803d; transform: translateY(-1px); }
    .sc-ab-pay-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

    .sc-ab-methods {
      text-align: center;
      font-size: 0.75rem;
      color: #94a3b8;
      margin-top: 10px;
    }

    /* Loading / error states */
    .sc-ab-loading {
      padding: 40px 0;
      text-align: center;
      color: #64748b;
      font-size: 0.9rem;
    }
    .sc-ab-error {
      padding: 16px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      color: #dc2626;
      font-size: 0.88rem;
    }
  `;
  document.head.appendChild(s);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" });
}

// ── Render ────────────────────────────────────────────────────────────────────

async function render() {
  const container = document.getElementById("sc-billing-widget");
  if (!container) return;

  injectStyles();
  container.innerHTML = `<div class="sc-ab-loading">⏳ Loading your plan…</div>`;

  let status;
  try {
    status = await checkPremium(supabase);
  } catch (err) {
    container.innerHTML = `<div class="sc-ab-error">⚠️ Could not load plan status. Please refresh the page.</div>`;
    return;
  }

  if (!status.isLoggedIn) {
    window.location.href = "/auth?redirect=/account";
    return;
  }

  // Expose email for Paystack
  if (status.email) window.__SC_USER_EMAIL = status.email;

  container.innerHTML = buildHTML(status);
  wireButtons(container, status);
}

function buildHTML(status) {
  return `
    ${planCardHTML(status)}
    ${featuresHTML(status)}
    ${upgradeHTML(status)}
  `;
}

// ── Plan card ─────────────────────────────────────────────────────────────────

function planCardHTML(status) {
  let badge;
  if (status.isPremium && !status.isTrial) {
    badge = `<span class="sc-ab-badge sc-ab-badge--premium">⭐ Premium</span>`;
  } else if (status.isTrial) {
    badge = `<span class="sc-ab-badge sc-ab-badge--trial">🕐 Organisation Trial</span>`;
  } else if (status.trialExpired) {
    badge = `<span class="sc-ab-badge sc-ab-badge--trial">⏰ Trial Expired</span>`;
  } else {
    badge = `<span class="sc-ab-badge sc-ab-badge--free">Free Plan</span>`;
  }

  let expiryLine = "";
  if (status.isPremium && !status.isTrial && status.expiresAt) {
    expiryLine = `<p class="sc-ab-expiry">Premium expires: ${fmtDate(status.expiresAt)}</p>`;
  } else if (status.isTrial && status.expiresAt) {
    expiryLine = `<p class="sc-ab-expiry">Trial ends: ${fmtDate(status.expiresAt)}</p>`;
  }

  const trialBar = status.isTrial ? trialBarHTML(status) : "";

  return `
    <div class="sc-ab-plan-card">
      <div class="sc-ab-plan-header">
        <span class="sc-ab-plan-label">Current Plan</span>
        ${badge}
      </div>
      ${expiryLine}
      ${trialBar}
    </div>
  `;
}

function trialBarHTML(status) {
  const TRIAL_DAYS = 30;
  const pct        = Math.max(0, Math.min(100, (status.daysLeft / TRIAL_DAYS) * 100));
  const fillClass  = pct > 40 ? "sc-ab-trial-bar__fill--ok"
                   : pct > 15 ? "sc-ab-trial-bar__fill--warning"
                               : "sc-ab-trial-bar__fill--danger";
  return `
    <div class="sc-ab-trial-bar">
      <div class="sc-ab-trial-bar__label">
        <span>Trial period</span>
        <span>${status.daysLeft} day${status.daysLeft !== 1 ? "s" : ""} remaining</span>
      </div>
      <div class="sc-ab-trial-bar__track">
        <div class="sc-ab-trial-bar__fill ${fillClass}" style="width:${pct}%"></div>
      </div>
    </div>
  `;
}

// ── Features list ─────────────────────────────────────────────────────────────

const FEATURES = [
  { label: "PAYE / net salary calculator",  always: true  },
  { label: "Salary comparison & percentile", always: true  },
  { label: "Gross-up calculator",            always: true  },
  { label: "PDF payslip download",           always: false },
  { label: "Bulk payroll export",            always: false },
  { label: "Ad-free experience",             always: false },
  { label: "Saved calculation history",      always: false },
  { label: "Priority support",               always: false },
];

function featuresHTML(status) {
  const hasAccess = status.isPremium;
  const items = FEATURES.map((f) => {
    const unlocked = f.always || hasAccess;
    const icon     = unlocked ? "✅" : "🔒";
    const cls      = unlocked ? "" : " sc-ab-features__item--locked";
    return `<li class="sc-ab-features__item${cls}">
      <span class="sc-ab-features__icon">${icon}</span>
      ${f.label}
    </li>`;
  }).join("");

  return `
    <div class="sc-ab-features">
      <p class="sc-ab-features__title">Features</p>
      <ul class="sc-ab-features__list">${items}</ul>
    </div>
  `;
}

// ── Upgrade section ───────────────────────────────────────────────────────────

function upgradeHTML(status) {
  const isPaidPremium = status.isPremium && !status.isTrial;

  const subtitle = isPaidPremium
    ? "Your premium is active. You can renew or change your plan below."
    : status.trialExpired
      ? "Your free trial has ended. Upgrade to keep all premium features."
      : status.isTrial
        ? `Your free trial ends in ${status.daysLeft} day${status.daysLeft !== 1 ? "s" : ""}. Lock in your plan now.`
        : "Upgrade to unlock PDF payslips, bulk exports, and more.";

  return `
    <div class="sc-ab-upgrade">
      <p class="sc-ab-upgrade__title">
        ${isPaidPremium ? "✅ Manage Your Plan" : "🚀 Upgrade to Premium"}
      </p>
      <p class="sc-ab-upgrade__sub">${subtitle}</p>

      <div class="sc-ab-plan-toggle">
        <button class="sc-ab-plan-toggle__btn active" data-plan="monthly" id="sc-ab-btn-monthly">
          <span class="sc-ab-plan-toggle__name">Monthly</span>
          <span class="sc-ab-plan-toggle__price">KES ${PRICE_MONTHLY_KES}</span>
          <span class="sc-ab-plan-toggle__period">/ month</span>
        </button>
        <button class="sc-ab-plan-toggle__btn" data-plan="yearly" id="sc-ab-btn-yearly">
          <span class="sc-ab-plan-toggle__badge">Best Value</span>
          <span class="sc-ab-plan-toggle__name">Yearly</span>
          <span class="sc-ab-plan-toggle__price">KES ${PRICE_YEARLY_KES}</span>
          <span class="sc-ab-plan-toggle__period">/ year</span>
          <span class="sc-ab-plan-toggle__saving">Save KES ${PRICE_SAVINGS_KES}</span>
        </button>
      </div>

      <button class="sc-ab-pay-btn" id="sc-ab-pay-btn">
        💳 Pay via M-Pesa / Card — KES <span id="sc-ab-price-display">${PRICE_MONTHLY_KES}</span>/mo
      </button>

      <p class="sc-ab-methods">
        Accepts M-Pesa &nbsp;·&nbsp; Visa &nbsp;·&nbsp; Mastercard &nbsp;·&nbsp; Secured by Paystack
      </p>
    </div>
  `;
}

// ── Wire buttons ──────────────────────────────────────────────────────────────

function wireButtons(container, status) {
  let selectedPlan = "monthly";

  const btnMonthly     = container.querySelector("#sc-ab-btn-monthly");
  const btnYearly      = container.querySelector("#sc-ab-btn-yearly");
  const payBtn         = container.querySelector("#sc-ab-pay-btn");
  const priceDisplay   = container.querySelector("#sc-ab-price-display");

  function selectPlan(plan) {
    selectedPlan = plan;
    [btnMonthly, btnYearly].forEach((b) => b?.classList.remove("active"));
    (plan === "yearly" ? btnYearly : btnMonthly)?.classList.add("active");

    const price  = plan === "yearly" ? PRICE_YEARLY_KES : PRICE_MONTHLY_KES;
    const period = plan === "yearly" ? "/yr" : "/mo";
    if (priceDisplay) priceDisplay.textContent = `${price}`;
    if (payBtn) {
      payBtn.innerHTML = `💳 Pay via M-Pesa / Card — KES ${price}${period}`;
    }
  }

  btnMonthly?.addEventListener("click", () => selectPlan("monthly"));
  btnYearly?.addEventListener("click",  () => selectPlan("yearly"));

  payBtn?.addEventListener("click", async () => {
    payBtn.disabled = true;
    payBtn.textContent = "⏳ Opening payment…";

    const email = status.email || window.__SC_USER_EMAIL;
    if (!email) {
      payBtn.disabled = false;
      selectPlan(selectedPlan); // restore button text
      showEmailCapture(selectedPlan, (captured) => {
        window.__SC_USER_EMAIL = captured;
        launchCheckout(selectedPlan, captured, payBtn);
      });
      return;
    }

    launchCheckout(selectedPlan, email, payBtn);
  });
}

function launchCheckout(plan, email, payBtn) {
  openPaystackCheckout({
    plan,
    email,
    onSuccess: async () => {
      invalidatePremiumCache();
      // Re-render the widget to show updated plan status
      await render();
      // Redirect to the thank-you page
      window.location.href = "/premium-thank-you";
    },
    onClose: () => {
      if (payBtn) {
        payBtn.disabled = false;
        const price  = plan === "yearly" ? PRICE_YEARLY_KES : PRICE_MONTHLY_KES;
        const period = plan === "yearly" ? "/yr" : "/mo";
        payBtn.innerHTML = `💳 Pay via M-Pesa / Card — KES ${price}${period}`;
      }
    },
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", render);
} else {
  render();
}
