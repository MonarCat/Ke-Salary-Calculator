/**
 * premium.js – Frontend premium status checker
 *
 * Checks whether the logged-in user has an active premium subscription,
 * using a 5-minute sessionStorage cache to avoid hammering Supabase.
 *
 * Public API (on window):
 *   KePremium.check()            → Promise<boolean>
 *   KePremium.gate(el, options)  → void  (attaches lock overlay to an element)
 *   KePremium.showUpgrade()      → void  (shows the full-screen upgrade modal)
 */

(function () {
    'use strict';

    const CACHE_KEY     = 'ke_premium_status';
    const CACHE_TTL_MS  = 5 * 60 * 1000; // 5 minutes

    // ── Helpers ───────────────────────────────────────────────────────────────

    function getCached() {
        try {
            const raw = sessionStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const obj = JSON.parse(raw);
            if (Date.now() - obj.ts > CACHE_TTL_MS) {
                sessionStorage.removeItem(CACHE_KEY);
                return null;
            }
            return obj.value;
        } catch (err) {
            console.warn('[KePremium] sessionStorage read error:', err.message);
            return null;
        }
    }

    function setCache(value) {
        try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({ value, ts: Date.now() }));
        } catch (err) {
            console.warn('[KePremium] sessionStorage write error:', err.message);
        }
    }

    // ── Core status check ─────────────────────────────────────────────────────

    async function check() {
        const cached = getCached();
        if (cached !== null) return cached;

        // Must have Supabase configured
        if (typeof supabaseClient === 'undefined' || !supabaseClient ||
            typeof isSupabaseConfigured === 'function' && !isSupabaseConfigured()) {
            setCache(false);
            return false;
        }

        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) {
                setCache(false);
                return false;
            }

            const { data, error } = await supabaseClient
                .rpc('check_premium_active', { p_user_id: session.user.id });

            if (error) {
                console.warn('[KePremium] check_premium_active error:', error.message);
                setCache(false);
                return false;
            }

            const isPremium = !!data;
            setCache(isPremium);
            return isPremium;
        } catch (err) {
            console.warn('[KePremium] check failed:', err.message);
            setCache(false);
            return false;
        }
    }

    // ── Lock-screen overlay ───────────────────────────────────────────────────

    /**
     * gate(element, options)
     * Wraps `element` in a position:relative container and injects a lock
     * overlay. If the user is premium the overlay is never shown.
     *
     * options:
     *   featureName  {string}  – human-readable name of the locked feature
     *   onUnlocked   {fn}      – optional callback when premium is confirmed
     */
    async function gate(element, options = {}) {
        if (!element) return;

        const isPremium = await check();
        if (isPremium) {
            if (typeof options.onUnlocked === 'function') options.onUnlocked();
            return;
        }

        // Prevent double-gating
        if (element.dataset.keGated) return;
        element.dataset.keGated = '1';

        const featureName = options.featureName || 'Premium Feature';

        // Make the parent container relative so the overlay covers it
        const wrapper = element.parentElement;
        if (wrapper) {
            const pos = getComputedStyle(wrapper).position;
            if (pos === 'static') wrapper.style.position = 'relative';
        }

        const overlay = document.createElement('div');
        overlay.className = 'ke-premium-gate';
        overlay.innerHTML = `
            <div class="ke-premium-gate__inner">
                <span class="ke-premium-gate__lock">🔒</span>
                <h3 class="ke-premium-gate__title">${featureName}</h3>
                <p class="ke-premium-gate__desc">Unlock this feature with a Premium subscription.</p>
                <button class="ke-premium-gate__btn" onclick="KePremium.showUpgrade()">
                    Upgrade to Premium
                </button>
                <p class="ke-premium-gate__mpesa">
                    Paid via M-Pesa?
                    <a href="mailto:kesalarycalculator@gmail.com?subject=Premium Activation">Contact us</a>
                </p>
            </div>`;

        // Insert the overlay as a sibling immediately after the element
        element.style.filter   = 'blur(4px)';
        element.style.pointerEvents = 'none';
        element.style.userSelect    = 'none';

        element.insertAdjacentElement('afterend', overlay);
    }

    // ── Upgrade modal ─────────────────────────────────────────────────────────

    function showUpgrade() {
        // Re-use if already in the DOM
        let modal = document.getElementById('ke-premium-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'ke-premium-modal';
            modal.className = 'ke-premium-modal';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-labelledby', 'ke-premium-modal-title');
            modal.innerHTML = `
                <div class="ke-premium-modal__backdrop" onclick="KePremium.closeUpgrade()"></div>
                <div class="ke-premium-modal__box">
                    <button class="ke-premium-modal__close" onclick="KePremium.closeUpgrade()" aria-label="Close">✕</button>
                    <div class="ke-premium-modal__icon">⭐</div>
                    <h2 class="ke-premium-modal__title" id="ke-premium-modal-title">Go Premium</h2>
                    <p class="ke-premium-modal__subtitle">
                        Remove ads, unlock advanced tools, and support the project.
                    </p>
                    <ul class="ke-premium-modal__features">
                        <li>✅ No ads – clean, distraction-free experience</li>
                        <li>✅ Advanced salary comparison tools</li>
                        <li>✅ Priority support &amp; early access to new features</li>
                    </ul>
                    <div class="ke-premium-modal__paypal">
                        <!-- PayPal Subscribe Button – replace hosted_button_id with your Premium button ID -->
                        <form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_top">
                            <input type="hidden" name="cmd"      value="_s-xclick" />
                            <input type="hidden" name="hosted_button_id" value="PREMIUM_BUTTON_ID" />
                            <input type="hidden" name="custom"   id="ke-paypal-custom-field" value="" />
                            <input type="image"
                                   src="https://www.paypalobjects.com/en_US/i/btn/btn_subscribeCC_LG.gif"
                                   border="0"
                                   name="submit"
                                   alt="Subscribe via PayPal" />
                        </form>
                    </div>
                    <p class="ke-premium-modal__mpesa">
                        Prefer M-Pesa?
                        <a href="mailto:kesalarycalculator@gmail.com?subject=Premium Activation – M-Pesa">
                            Email us after paying
                        </a>
                        and we'll activate your account within 24 hours.
                    </p>
                </div>`;
            document.body.appendChild(modal);
        }

        // Pre-fill custom field with user id for webhook matching
        _prefillPayPalCustom();

        modal.classList.add('ke-premium-modal--open');
        document.body.style.overflow = 'hidden';
    }

    function closeUpgrade() {
        const modal = document.getElementById('ke-premium-modal');
        if (modal) modal.classList.remove('ke-premium-modal--open');
        document.body.style.overflow = '';
    }

    async function _prefillPayPalCustom() {
        try {
            if (typeof supabaseClient === 'undefined' || !supabaseClient) return;
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) return;
            const el = document.getElementById('ke-paypal-custom-field');
            if (el) el.value = session.user.id;
        } catch (err) {
            console.warn('[KePremium] PayPal custom field pre-fill failed:', err.message);
        }
    }

    // ── Export ────────────────────────────────────────────────────────────────

    window.KePremium = { check, gate, showUpgrade, closeUpgrade };

})();
