/**
 * newsletter.js – Newsletter subscription component
 *
 * Works for both anonymous and signed-in users.
 * - Signed-in users see their email pre-filled for a one-click subscribe.
 * - Source is tracked so you know which page drove subscriptions.
 * - Saves to Supabase `newsletter_subscribers` table (upsert).
 *
 * Usage: included by calculator-enhancements.js
 * Public API: window.KeNewsletter.init(containerEl, source)
 */

(function () {
    'use strict';

    // ── Core subscription logic ───────────────────────────────────────────────

    async function subscribe(email, source) {
        email = (email || '').trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return { ok: false, message: 'Please enter a valid email address.' };
        }

        if (typeof supabaseClient === 'undefined' || !supabaseClient ||
            typeof isSupabaseConfigured === 'function' && !isSupabaseConfigured()) {
            return { ok: false, message: 'Service unavailable. Please try again later.' };
        }

        // Uses a SECURITY DEFINER RPC rather than a raw table upsert. A raw
        // `.upsert(..., {onConflict:'email'})` from an anonymous client
        // always failed here: Postgres must evaluate the table's UPDATE/
        // SELECT RLS policies to plan any INSERT ... ON CONFLICT DO UPDATE
        // statement (even for a brand-new email with no real conflict), and
        // this table intentionally has no permissive SELECT policy for
        // anon (so the subscriber list can't be scraped via the public
        // key). The RPC gives a safe, narrow, validated write path without
        // loosening that protection.
        const { error } = await supabaseClient.rpc('subscribe_to_newsletter', {
            p_email: email,
            p_source: source || 'website',
        });

        if (error) {
            console.warn('[KeNewsletter] subscribe error:', error.message);
            return { ok: false, message: 'Subscription failed. Please try again.' };
        }

        return { ok: true, message: '🎉 You\'re subscribed! We\'ll notify you of important updates.' };
    }

    // ── UI rendering ──────────────────────────────────────────────────────────

    async function init(container, source) {
        if (!container) return;

        source = source || document.body.dataset.newsletterSource || 'website';

        // Try to get signed-in user email for pre-fill
        let prefillEmail = '';
        try {
            if (typeof supabaseClient !== 'undefined' && supabaseClient) {
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (session && session.user.email) {
                    prefillEmail = session.user.email;
                }
            }
        } catch (err) {
            console.warn('[KeNewsletter] Email pre-fill failed:', err.message);
        }

        container.innerHTML = `
            <div class="ke-newsletter">
                <div class="ke-newsletter__icon">📬</div>
                <h3 class="ke-newsletter__title">Stay Updated</h3>
                <p class="ke-newsletter__desc">
                    Get notified of new tax rate changes, salary guides, and calculator updates.
                    No spam – unsubscribe anytime.
                </p>
                <form class="ke-newsletter__form" novalidate>
                    <div class="ke-newsletter__row">
                        <input
                            type="email"
                            class="ke-newsletter__input"
                            placeholder="your@email.com"
                            value="${_escapeHtml(prefillEmail)}"
                            autocomplete="email"
                            aria-label="Email address"
                            required />
                        <button type="submit" class="ke-newsletter__btn">
                            ${prefillEmail ? '✓ Subscribe' : 'Subscribe'}
                        </button>
                    </div>
                    <p class="ke-newsletter__msg" aria-live="polite"></p>
                </form>
            </div>`;

        const form  = container.querySelector('.ke-newsletter__form');
        const input = container.querySelector('.ke-newsletter__input');
        const btn   = container.querySelector('.ke-newsletter__btn');
        const msg   = container.querySelector('.ke-newsletter__msg');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            btn.disabled    = true;
            btn.textContent = 'Subscribing…';
            msg.textContent = '';
            msg.className   = 'ke-newsletter__msg';

            const result = await subscribe(input.value, source);

            msg.textContent = result.message;
            msg.classList.add(result.ok ? 'ke-newsletter__msg--ok' : 'ke-newsletter__msg--err');

            if (result.ok) {
                btn.textContent = '✓ Subscribed';
                // Don't re-enable button on success to prevent double-submit
            } else {
                btn.disabled    = false;
                btn.textContent = 'Subscribe';
            }
        });
    }

    function _escapeHtml(str) {
        return str.replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    // ── Auto-init ─────────────────────────────────────────────────────────────

    function autoInit() {
        const containers = document.querySelectorAll('[data-ke-newsletter]');
        containers.forEach(el => {
            const source = el.dataset.keNewsletter || 'website';
            init(el, source);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        autoInit();
    }

    window.KeNewsletter = { init, subscribe };

})();
