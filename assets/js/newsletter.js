/**
 * /assets/js/newsletter.js
 *
 * Newsletter subscription widget.
 * Works for both anonymous and signed-in users.
 * Saves to Supabase `newsletter_subscribers` table (upsert on email conflict).
 *
 * Usage:
 *   import { initNewsletter } from './newsletter.js';
 *   initNewsletter(supabase, 'newsletter-widget-calc', { source: 'calculator' });
 *
 * @param {object} supabase  — Supabase client
 * @param {string} containerId — DOM element ID to render widget into
 * @param {{ source?: string }} [opts]
 */

function _escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

async function _subscribe(supabase, email, source) {
  email = (email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Please enter a valid email address." };
  }

  const { error } = await supabase
    .from("newsletter_subscribers")
    .upsert({ email, source: source || "website" }, { onConflict: "email" });

  if (error) {
    console.error("[Newsletter] subscribe error:", error.message);
    return { ok: false, message: "Subscription failed. Please try again." };
  }

  return { ok: true, message: "🎉 You're subscribed! We'll notify you of important updates." };
}

export async function initNewsletter(supabase, containerId, opts = {}) {
  const container = typeof containerId === "string"
    ? document.getElementById(containerId)
    : containerId;

  if (!container) return;

  const source = opts.source || "website";

  // Pre-fill email for signed-in users
  let prefillEmail = "";
  try {
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) prefillEmail = session.user.email;
    }
  } catch (_) {
    // non-fatal
  }

  container.innerHTML = `
    <div class="sc-newsletter">
      <div class="sc-newsletter__icon">📬</div>
      <h3 class="sc-newsletter__title">Stay Updated</h3>
      <p class="sc-newsletter__desc">
        Get notified of new tax rate changes, salary guides, and calculator updates.
        No spam – unsubscribe anytime.
      </p>
      <form class="sc-newsletter__form" novalidate>
        <div class="sc-newsletter__row">
          <input
            type="email"
            class="sc-newsletter__input"
            placeholder="your@email.com"
            value="${_escapeHtml(prefillEmail)}"
            autocomplete="email"
            aria-label="Email address"
            required />
          <button type="submit" class="sc-newsletter__btn">
            ${prefillEmail ? "✓ Subscribe" : "Subscribe"}
          </button>
        </div>
        <p class="sc-newsletter__msg" aria-live="polite"></p>
      </form>
    </div>`;

  const form  = container.querySelector(".sc-newsletter__form");
  const input = container.querySelector(".sc-newsletter__input");
  const btn   = container.querySelector(".sc-newsletter__btn");
  const msg   = container.querySelector(".sc-newsletter__msg");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    btn.disabled    = true;
    btn.textContent = "Subscribing…";
    msg.textContent = "";
    msg.className   = "sc-newsletter__msg";

    const result = await _subscribe(supabase, input.value, source);

    msg.textContent = result.message;
    msg.classList.add(result.ok ? "sc-newsletter__msg--ok" : "sc-newsletter__msg--err");

    if (result.ok) {
      btn.textContent = "✓ Subscribed";
    } else {
      btn.disabled    = false;
      btn.textContent = "Subscribe";
    }
  });
}
