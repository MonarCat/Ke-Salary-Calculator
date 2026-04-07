/**
 * /assets/js/premium.js
 *
 * Premium status check and UI gate.
 * Payment provider: Paystack
 *
 * PRICING — charged in KES via Paystack:
 *   Monthly : KES 499  / month
 *   Yearly  : KES 4,999 / year  (saves KES 989 vs monthly)
 *
 * ENV required (set via window.__PAYSTACK_PUBLIC_KEY in your HTML head):
 *   window.__PAYSTACK_PUBLIC_KEY = "pk_live_xxxxxxxxxxxx";
 *
 * checkPremium() returns: { isPremium, expiresAt, isLoggedIn, email }
 *
 * Compatible with Vercel and Cloudflare Pages.
 */

// ── Constants ─────────────────────────────────────────────────────────────────

const CACHE_KEY    = "sc_premium_status";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Easter 2026 Holiday Promotion — free premium access for all users until end of April 2026 (EAT, UTC+3).
export const EASTER_FREE_UNTIL = new Date("2026-04-30T23:59:59+03:00");

// Pricing in KES (Paystack Kenya native currency)
export const PRICE_MONTHLY_KES = 499;
export const PRICE_YEARLY_KES  = 4999;
export const PRICE_SAVINGS_KES = (PRICE_MONTHLY_KES * 12) - PRICE_YEARLY_KES; // 989

export const SITE_URL         = "https://salarycalculator.co.ke";
export const PAYSTACK_WEBHOOK = `${SITE_URL}/api/paystack-webhook`;

// Paystack plan/product codes — read from window variables set in HTML <head>.
// Leave empty (or don't set the window var) for one-time charge (no auto-renew).
export const PLAN_CODE_MONTHLY = window.__PAYSTACK_PLAN_MONTHLY || "";
export const PLAN_CODE_YEARLY  = window.__PAYSTACK_PLAN_YEARLY  || "";

// ── Premium check ─────────────────────────────────────────────────────────────

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<{ isPremium: boolean, expiresAt: Date|null, isLoggedIn: boolean, email: string|null }>}
 */
export async function checkPremium(supabase) {
  // Easter 2026 Holiday Promotion: grant free premium access to all users.
  if (Date.now() < EASTER_FREE_UNTIL.getTime()) {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.cachedAt < CACHE_TTL_MS) return parsed.data;
      } catch (_) {}
    }
    const { data: { user } } = await supabase.auth.getUser();
    // Only grant free access to signed-in users; visitors must sign up.
    const result = _build({ isPremium: !!user, isLoggedIn: !!user, email: user?.email || null });
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ cachedAt: Date.now(), data: result }));
    return result;
  }

  const cached = sessionStorage.getItem(CACHE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.cachedAt < CACHE_TTL_MS) return parsed.data;
    } catch (_) {}
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return _build({ isLoggedIn: false });

  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("premium, premium_expires_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) return _build({ isLoggedIn: true, email: user.email || null });

  const now        = new Date();
  const paidExpiry = profile.premium_expires_at ? new Date(profile.premium_expires_at) : null;
  const isPremium  = profile.premium === true && (!paidExpiry || paidExpiry > now);

  const result = _build({
    isLoggedIn: true,
    isPremium,
    expiresAt:  isPremium ? paidExpiry : null,
    email:      user.email || null,
  });

  sessionStorage.setItem(CACHE_KEY, JSON.stringify({ cachedAt: Date.now(), data: result }));
  return result;
}

function _build(o = {}) {
  return {
    isLoggedIn: false,
    isPremium:  false,
    expiresAt:  null,
    email:      null,
    ...o,
  };
}

export function invalidatePremiumCache() {
  sessionStorage.removeItem(CACHE_KEY);
}

// ── Paystack payment launcher ─────────────────────────────────────────────────

/**
 * Load the Paystack inline script if not already present, then resolve.
 */
function loadPaystack() {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) return resolve();
    const s = document.createElement("script");
    s.src = "https://js.paystack.co/v1/inline.js";
    s.onload  = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/**
 * Open the Paystack payment popup.
 *
 * @param {{ plan: 'monthly'|'yearly', email: string, onSuccess: Function, onClose?: Function }} opts
 */
export async function openPaystackCheckout({ plan = "yearly", email, onSuccess, onClose }) {
  await loadPaystack();

  const publicKey = window.__PAYSTACK_PUBLIC_KEY;
  if (!publicKey) {
    console.error("[Paystack] window.__PAYSTACK_PUBLIC_KEY is not set.");
    alert("Payment configuration missing. Please contact support.");
    return;
  }

  const isYearly = plan === "yearly";
  const amount   = isYearly ? PRICE_YEARLY_KES  : PRICE_MONTHLY_KES;
  // Read plan codes from window variables (set in HTML head); fall back to module constants
  const planCode = isYearly
    ? (window.__PAYSTACK_PLAN_YEARLY  || PLAN_CODE_YEARLY)
    : (window.__PAYSTACK_PLAN_MONTHLY || PLAN_CODE_MONTHLY);
  const label    = isYearly ? "1-Year Premium"   : "Monthly Premium";

  // Generate a unique reference
  const ref = `SC-${plan.toUpperCase()}-${Date.now()}`;

  const config = {
    key:      publicKey,
    email:    email || "",
    amount:   amount * 100,        // Paystack amounts are in kobo/cents × 100
    currency: "KES",
    ref,
    label:    `SalaryCalculator.co.ke — ${label}`,
    metadata: {
      custom_fields: [
        { display_name: "Plan",    variable_name: "plan",    value: plan },
        { display_name: "Product", variable_name: "product", value: "salarycalculator_premium" },
      ],
    },
    callback: function (response) {
      // response.reference is the transaction reference to verify server-side
      onSuccess && onSuccess(response);
      // Optionally verify immediately
      _verifyPaystackTransaction(response.reference);
    },
    onClose: function () {
      onClose && onClose();
    },
  };

  // If you've set up recurring plans in Paystack dashboard, add plan code:
  if (planCode) config.plan = planCode;

  const handler = window.PaystackPop.setup(config);
  handler.openIframe();
}

/**
 * Optionally call our backend to verify & activate premium after payment.
 * The webhook handles this automatically, but this provides instant feedback.
 */
async function _verifyPaystackTransaction(reference) {
  try {
    const res = await fetch(`/api/paystack-verify?ref=${encodeURIComponent(reference)}`, {
      method: "POST",
    });
    if (res.ok) {
      invalidatePremiumCache();
      // Redirect to thank-you page
      window.location.href = "/premium-thank-you";
    }
  } catch (err) {
    // Webhook will activate premium in the background — redirect anyway
    window.location.href = "/premium-thank-you";
  }
}

// ── Premium gate UI ───────────────────────────────────────────────────────────

export function showPremiumGate(elementId, message = "This is a Premium feature") {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.style.position = "relative";
  el.style.overflow = "hidden";
  if (el.querySelector(".sc-premium-gate")) return;

  const gate = document.createElement("div");
  gate.className = "sc-premium-gate";
  gate.setAttribute("aria-label", "Premium feature locked");
  gate.innerHTML = `
    <div class="sc-premium-gate__inner">
      <div class="sc-premium-gate__icon">🔒</div>
      <h3 class="sc-premium-gate__title">${message}</h3>
      <p class="sc-premium-gate__body">
        Unlock all premium features from just <strong>KES ${PRICE_MONTHLY_KES}/month</strong>.
      </p>

      <div class="sc-premium-gate__pricing">
        <div class="sc-price-card sc-price-card--monthly">
          <span class="sc-price-card__label">Monthly</span>
          <span class="sc-price-card__amount">KES ${PRICE_MONTHLY_KES}</span>
          <span class="sc-price-card__period">/ month</span>
        </div>
        <div class="sc-price-card sc-price-card--yearly sc-price-card--best">
          <span class="sc-price-card__badge">Best Value</span>
          <span class="sc-price-card__label">Yearly</span>
          <span class="sc-price-card__amount">KES ${PRICE_YEARLY_KES}</span>
          <span class="sc-price-card__period">/ year</span>
          <span class="sc-price-card__saving">Save KES ${PRICE_SAVINGS_KES}</span>
        </div>
      </div>

      <div class="sc-premium-gate__actions">
        <button class="sc-btn sc-btn--primary" data-paystack-plan="yearly" data-gate-id="${elementId}">
          💳 Upgrade — KES ${PRICE_YEARLY_KES}/year
        </button>
        <button class="sc-btn sc-btn--outline" data-paystack-plan="monthly" data-gate-id="${elementId}">
          Pay Monthly — KES ${PRICE_MONTHLY_KES}/mo
        </button>
        <a href="/contact-us" class="sc-btn sc-btn--ghost">
          Need help? Contact us →
        </a>
      </div>

      <p class="sc-premium-gate__includes">
        ✅ M-Pesa &amp; Card &nbsp;·&nbsp;
        ✅ PDF payslip &nbsp;·&nbsp;
        ✅ Bulk export &nbsp;·&nbsp;
        ✅ Ad-free &nbsp;·&nbsp;
        ✅ Saved history
      </p>
    </div>
  `;

  const blur = document.createElement("div");
  blur.className = "sc-premium-gate__blur";
  el.appendChild(blur);
  el.appendChild(gate);

  // Wire up Paystack buttons inside this gate
  gate.querySelectorAll("[data-paystack-plan]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const email = window.__SC_USER_EMAIL;
      if (!email) {
        _showEmailCapture(btn.dataset.paystackPlan, elementId);
        return;
      }
      openPaystackCheckout({
        plan:      btn.dataset.paystackPlan,
        email,
        onSuccess: () => { hidePremiumGate(elementId); invalidatePremiumCache(); },
      });
    });
  });
}

/**
 * showEmailCapture — inline modal to collect user email before Paystack checkout.
 *
 * Exported so that other modules (e.g. trial-banner.js) can reuse it rather
 * than duplicating the implementation.
 *
 * @param {string}   plan         — 'monthly' | 'yearly'
 * @param {Function} onEmail      — called with the validated email string
 */
export function showEmailCapture(plan, onEmail) {
  const existing = document.getElementById("sc-email-capture-modal");
  if (existing) { existing.remove(); }

  const modal = document.createElement("div");
  modal.id = "sc-email-capture-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "Enter your email to continue");
  modal.style.cssText = [
    "position:fixed", "inset:0", "z-index:9999",
    "display:flex", "align-items:center", "justify-content:center",
    "background:rgba(0,0,0,0.55)",
  ].join(";");

  modal.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:28px 24px;max-width:360px;
                width:calc(100% - 32px);box-shadow:0 8px 40px rgba(0,0,0,0.22);text-align:center;">
      <h3 style="margin:0 0 8px;font-size:1.15rem;font-weight:700;color:#0f172a;">
        Enter your email to continue
      </h3>
      <p style="margin:0 0 16px;font-size:0.88rem;color:#475569;">
        We'll use this to activate your subscription.
      </p>
      <input id="sc-email-capture-input" type="email" autocomplete="email"
        placeholder="you@example.com"
        style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e2e8f0;
               border-radius:8px;font-size:1rem;margin-bottom:12px;outline:none;" />
      <div style="display:flex;gap:8px;">
        <button id="sc-email-capture-cancel"
          style="flex:1;padding:10px;border:1.5px solid #e2e8f0;border-radius:8px;
                 background:#fff;color:#475569;font-size:0.88rem;cursor:pointer;">
          Cancel
        </button>
        <button id="sc-email-capture-submit"
          style="flex:2;padding:10px;border:none;border-radius:8px;
                 background:#16a34a;color:#fff;font-size:0.88rem;font-weight:600;cursor:pointer;">
          Continue →
        </button>
      </div>
    </div>`;

  document.body.appendChild(modal);

  const input  = modal.querySelector("#sc-email-capture-input");
  const submit = modal.querySelector("#sc-email-capture-submit");
  const cancel = modal.querySelector("#sc-email-capture-cancel");

  input.focus();

  function proceed() {
    const val = input.value.trim();
    if (!val || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      input.style.borderColor = "#dc2626";
      input.focus();
      return;
    }
    modal.remove();
    onEmail(val);
  }

  submit.addEventListener("click", proceed);
  cancel.addEventListener("click", () => modal.remove());
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") proceed(); });
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
}

// Internal alias used by showPremiumGate / gateFeature
function _showEmailCapture(plan, gateElementId) {
  showEmailCapture(plan, (email) => {
    openPaystackCheckout({
      plan,
      email,
      onSuccess: () => { hidePremiumGate(gateElementId); invalidatePremiumCache(); },
    });
  });
}

export function hidePremiumGate(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.querySelector(".sc-premium-gate")?.remove();
  el.querySelector(".sc-premium-gate__blur")?.remove();
  el.style.overflow = "";
}


export async function gateFeature(supabase, elementId, message) {
  const status = await checkPremium(supabase);
  if (status.isPremium) { hidePremiumGate(elementId); return true; }

  // Expose email for Paystack popup
  if (status.email) window.__SC_USER_EMAIL = status.email;

  if (!status.isLoggedIn) {
    _showSignInNudge(elementId);
    return false;
  }

  showPremiumGate(elementId, message);
  return false;
}

function _showSignInNudge(elementId) {
  const el = document.getElementById(elementId);
  if (!el || el.querySelector(".sc-signin-gate")) return;
  const nudge = document.createElement("div");
  nudge.className = "sc-signin-gate";
  nudge.innerHTML = `
    <div class="sc-premium-gate__inner" style="background:#f0fdf4;border:1px solid #86efac">
      <div class="sc-premium-gate__icon">👋</div>
      <h3 class="sc-premium-gate__title">Create a free account to continue</h3>
      <p class="sc-premium-gate__body">
        Sign up free in 30 seconds to access premium features.
      </p>
      <a href="/auth" class="sc-btn sc-btn--primary" style="text-decoration:none">
        Sign Up Free →
      </a>
    </div>
  `;
  el.style.position = "relative";
  el.appendChild(nudge);
}
