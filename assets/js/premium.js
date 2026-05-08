/**
 * /assets/js/premium.js
 *
 * Premium status check and auth gate helpers.
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

// Legacy pricing constants retained for compatibility with older imports.
export const PRICE_MONTHLY_KES = 0;
export const PRICE_YEARLY_KES  = 0;
export const PRICE_SAVINGS_KES = (PRICE_MONTHLY_KES * 12) - PRICE_YEARLY_KES;

export const SITE_URL         = "https://salarycalculator.co.ke";
export const PAYSTACK_WEBHOOK = `${SITE_URL}/api/paystack-webhook`;

// Paystack plan/product codes — read from window variables set in HTML <head>.
// Leave empty (or don't set the window var) for one-time charge (no auto-renew).
export const PLAN_CODE_MONTHLY = window.__PAYSTACK_PLAN_MONTHLY || "";
export const PLAN_CODE_YEARLY  = window.__PAYSTACK_PLAN_YEARLY  || "";

// ── Profile-based premium helpers ─────────────────────────────────────────────

/**
 * Returns true if the user currently has active premium access.
 * Checks both the boolean flag AND premium_expires_at.
 * A null expiry means the premium never expires (treat as active).
 *
 * @param {{ premium?: boolean, premium_expires_at?: string|null }} profile
 * @returns {boolean}
 */
export function isPremium(profile) {
  if (!profile) return false;
  if (!profile.premium) return false;
  if (!profile.premium_expires_at) return true;
  return new Date(profile.premium_expires_at) > new Date();
}

/**
 * Returns the premium source label for UI display.
 *
 * @param {{ premium_source?: string|null }} profile
 * @returns {string}
 */
export function getPremiumLabel(profile) {
  const sourceMap = {
    paystack:          "Paystack Subscription",
    mpesa:             "M-Pesa Subscription",
    manual:            "Manual Grant",
    promo:             "Promo Access",
    easter_gift_2026:  "🐣 Easter Holiday Gift",
  };
  return sourceMap[profile?.premium_source] || "Premium";
}

/**
 * Returns formatted expiry string, e.g. "30 Apr 2026".
 *
 * @param {{ premium_expires_at?: string|null }} profile
 * @returns {string|null}
 */
export function getPremiumExpiry(profile) {
  if (!profile?.premium_expires_at) return null;
  return new Date(profile.premium_expires_at).toLocaleDateString("en-KE", {
    day:   "numeric",
    month: "short",
    year:  "numeric",
  });
}

// ── Premium check ─────────────────────────────────────────────────────────────

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<{ isPremium: boolean, expiresAt: Date|null, isLoggedIn: boolean, email: string|null, premiumSource: string|null, premiumExpiresAt: string|null }>}
 */
export async function checkPremium(supabase) {
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
    .select("premium, premium_expires_at, premium_source")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) return _build({ isLoggedIn: true, email: user.email || null });

  // Easter 2026 Holiday Promotion: grant free premium access to all signed-in users.
  const duringEaster = Date.now() < EASTER_FREE_UNTIL.getTime();
  const profilePremium = isPremium(profile);
  const premiumActive  = profilePremium || duringEaster;

  const paidExpiry = profile.premium_expires_at ? new Date(profile.premium_expires_at) : null;

  const result = _build({
    isLoggedIn:       true,
    isPremium:        premiumActive,
    expiresAt:        premiumActive ? paidExpiry : null,
    email:            user.email || null,
    premiumSource:    profile.premium_source || null,
    premiumExpiresAt: profile.premium_expires_at || null,
  });

  sessionStorage.setItem(CACHE_KEY, JSON.stringify({ cachedAt: Date.now(), data: result }));
  return result;
}

function _build(o = {}) {
  return {
    isLoggedIn:       false,
    isPremium:        false,
    expiresAt:        null,
    email:            null,
    premiumSource:    null,
    premiumExpiresAt: null,
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
  console.info("[Premium] Checkout is disabled. Features are now free.");
  invalidatePremiumCache();
  onSuccess && onSuccess({ reference: null, plan, email: email || null });
  onClose && onClose();
}

/**
 * Call our backend to verify & activate premium after payment, then
 * redirect to the thank-you page unconditionally.
 *
 * The webhook (/api/paystack-webhook) is the authoritative activation path
 * and will retry on failure. This call provides instant feedback but we must
 * NOT block the redirect on its success — if the verify call itself errors,
 * the user would be stuck on the current page with no feedback.
 */
async function _verifyPaystackTransaction(reference) {
  try {
    await fetch(`/api/paystack-verify?ref=${encodeURIComponent(reference)}`, {
      method: "POST",
    });
  } catch (_) {
    // Network error — webhook will activate premium in the background.
  }
  // Always clear the cache and redirect, regardless of verify result.
  invalidatePremiumCache();
  window.location.href = `/premium-thank-you?ref=${encodeURIComponent(reference)}`;
}

// ── Premium gate UI ───────────────────────────────────────────────────────────

export function showPremiumGate(elementId, message = "This is a Premium feature") {
  _showSignInNudge(elementId);
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
  showEmailCapture(plan, () => {
    hidePremiumGate(gateElementId);
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
  hidePremiumGate(elementId);

  // Expose email for compatibility with existing auth-aware flows.
  if (status.email) window.__SC_USER_EMAIL = status.email;

  if (!status.isLoggedIn) {
    _showSignInNudge(elementId);
    return false;
  }

  return true;
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
