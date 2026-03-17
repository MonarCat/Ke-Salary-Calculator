/**
 * /assets/js/trial-banner.js
 *
 * Trial period reminder banner — Paystack edition.
 * Replaces PayPal buttons with Paystack inline checkout.
 *
 * Shows when:
 *  - Organisation-tier user has ≤3 days left on trial (dismissible)
 *  - Trial has expired (NOT dismissible until they upgrade)
 *
 * Usage:
 *   import { initTrialBanner } from './trial-banner.js';
 *   initTrialBanner(supabase);
 */

import { checkPremium, openPaystackCheckout, invalidatePremiumCache,
         showEmailCapture,
         PRICE_MONTHLY_KES, PRICE_YEARLY_KES } from "./premium.js";

const DISMISS_KEY = "sc_trial_banner_dismissed";

// ── Styles (injected once) ────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById("sc-trial-banner-styles")) return;
  const s = document.createElement("style");
  s.id = "sc-trial-banner-styles";
  s.textContent = `
    #sc-trial-banner {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      z-index: 9000;
      transform: translateY(100%);
      transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1);
    }
    #sc-trial-banner.sc-trial-banner--visible { transform: translateY(0); }

    .sc-trial-banner__inner {
      margin: 0 auto;
      max-width: 960px;
      background: #fff;
      border-top: 3px solid #16a34a;
      box-shadow: 0 -4px 32px rgba(0,0,0,0.13);
      border-radius: 16px 16px 0 0;
      padding: 1.1rem 1.5rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }
    [data-theme="dark"] .sc-trial-banner__inner {
      background: #0f172a;
      color: #e2e8f0;
      border-color: #22c55e;
    }
    .sc-trial-banner__icon  { font-size: 1.8rem; flex-shrink: 0; }
    .sc-trial-banner__content { flex: 1; min-width: 180px; }
    .sc-trial-banner__title {
      font-weight: 700; font-size: 0.97rem;
      color: #0f172a; margin: 0 0 0.15rem;
    }
    [data-theme="dark"] .sc-trial-banner__title { color: #f1f5f9; }
    .sc-trial-banner__sub  { font-size: 0.83rem; color: #475569; margin: 0; }
    [data-theme="dark"] .sc-trial-banner__sub { color: #94a3b8; }
    .sc-trial-banner__actions {
      display: flex; gap: 0.5rem;
      flex-wrap: wrap; align-items: center;
    }

    /* Countdown pill */
    .sc-trial-countdown {
      display: inline-flex; align-items: center; gap: 0.3rem;
      background: #fef2f2; border: 1px solid #fecaca;
      color: #dc2626; border-radius: 20px;
      padding: 0.22rem 0.75rem;
      font-size: 0.78rem; font-weight: 700; flex-shrink: 0;
    }
    .sc-trial-countdown--safe {
      background: #f0fdf4; border-color: #bbf7d0; color: #166534;
    }

    /* Buttons */
    .sc-tb-btn {
      display: inline-flex; align-items: center; gap: 0.35rem;
      padding: 0.55rem 1.1rem; border-radius: 8px;
      font-size: 0.84rem; font-weight: 600;
      cursor: pointer; border: none; white-space: nowrap;
      text-decoration: none; transition: all 0.17s ease;
      min-height: 40px; touch-action: manipulation;
    }
    .sc-tb-btn--upgrade   { background: #16a34a; color: #fff; }
    .sc-tb-btn--upgrade:hover { background: #15803d; transform: translateY(-1px); }
    .sc-tb-btn--monthly   { background: transparent; color: #16a34a; border: 1.5px solid #16a34a; }
    .sc-tb-btn--monthly:hover { background: #f0fdf4; }
    .sc-tb-btn--dismiss   {
      background: transparent; color: #94a3b8;
      font-size: 0.78rem; padding: 0.4rem 0.6rem; border: none;
    }
    .sc-tb-btn--dismiss:hover { color: #475569; }
    .sc-tb-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    /* Mobile */
    @media (max-width: 600px) {
      .sc-trial-banner__inner { padding: 1rem; gap: 0.75rem; }
      .sc-trial-banner__actions { width: 100%; }
      .sc-tb-btn--upgrade,
      .sc-tb-btn--monthly { flex: 1; justify-content: center; }
    }
  `;
  document.head.appendChild(s);
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderBanner({ daysLeft, trialExpired, email }) {
  if (!trialExpired && sessionStorage.getItem(DISMISS_KEY)) return;

  injectStyles();
  document.getElementById("sc-trial-banner")?.remove();

  const pillClass = trialExpired ? "sc-trial-countdown"
    : daysLeft <= 1 ? "sc-trial-countdown"
    : "sc-trial-countdown--safe";

  const pillText = trialExpired ? "⏰ Trial Ended"
    : daysLeft === 1 ? "⚠️ Last Day"
    : `🕐 ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`;

  const title = trialExpired
    ? "Your free trial has ended"
    : `Your free trial expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`;

  const sub = trialExpired
    ? "Upgrade now to keep PDF payslips, bulk exports, and ad-free experience."
    : "Upgrade before it ends to lock in your Organisation features.";

  const banner = document.createElement("div");
  banner.id = "sc-trial-banner";
  banner.setAttribute("role", "status");
  banner.setAttribute("aria-live", "polite");
  banner.innerHTML = `
    <div class="sc-trial-banner__inner">
      <div class="sc-trial-banner__icon">${trialExpired ? "⏰" : "✨"}</div>

      <div class="sc-trial-banner__content">
        <p class="sc-trial-banner__title">${title}</p>
        <p class="sc-trial-banner__sub">${sub} Pay via <strong>M-Pesa, Visa, or Mastercard</strong>.</p>
      </div>

      <span class="sc-trial-countdown ${pillClass}">${pillText}</span>

      <div class="sc-trial-banner__actions">
        <button class="sc-tb-btn sc-tb-btn--upgrade" id="sc-tb-yearly">
          ⭐ Upgrade — KES ${PRICE_YEARLY_KES}/yr
        </button>
        <button class="sc-tb-btn sc-tb-btn--monthly" id="sc-tb-monthly">
          KES ${PRICE_MONTHLY_KES}/mo
        </button>
        ${!trialExpired
          ? `<button class="sc-tb-btn sc-tb-btn--dismiss" id="sc-banner-dismiss">✕ Later</button>`
          : ""
        }
      </div>
    </div>
  `;

  document.body.appendChild(banner);
  requestAnimationFrame(() => {
    setTimeout(() => banner.classList.add("sc-trial-banner--visible"), 600);
  });

  // ── Button handlers ──────────────────────────────────────────────────────

  function launchPaystack(plan) {
    const userEmail = email || window.__SC_USER_EMAIL;
    if (!userEmail) {
      showEmailCapture(plan, (captured) => {
        openPaystackCheckout({
          plan,
          email: captured,
          onSuccess: () => {
            invalidatePremiumCache();
            window.location.href = "/premium-thank-you";
          },
        });
      });
      return;
    }
    openPaystackCheckout({
      plan,
      email: userEmail,
      onSuccess: () => {
        invalidatePremiumCache();
        window.location.href = "/premium-thank-you";
      },
    });
  }

  document.getElementById("sc-tb-yearly")?.addEventListener("click", () => launchPaystack("yearly"));
  document.getElementById("sc-tb-monthly")?.addEventListener("click", () => launchPaystack("monthly"));

  document.getElementById("sc-banner-dismiss")?.addEventListener("click", () => {
    banner.classList.remove("sc-trial-banner--visible");
    sessionStorage.setItem(DISMISS_KEY, "1");
    setTimeout(() => banner.remove(), 400);
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

export async function initTrialBanner(supabase) {
  const status = await checkPremium(supabase);
  if (!status.isLoggedIn) return;
  if (status.isPremium && !status.isTrial) return; // fully paid — no banner

  // Expose email globally for Paystack popup
  if (status.email) window.__SC_USER_EMAIL = status.email;

  if (status.reminderDue || status.trialExpired) {
    renderBanner({
      daysLeft:      status.daysLeft,
      trialExpired:  status.trialExpired,
      email:         status.email,
    });
  }
}
