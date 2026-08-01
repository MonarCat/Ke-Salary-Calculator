/**
 * adslots.js – ad placeholder management
 *
 * Creates standardised ad placeholder divs for ad networks to fill.
 * Critically, hides ALL ads when isPremium === true (premium value proposition).
 *
 * Usage: included by calculator-enhancements.js
 * Also available via window.KeAdSlots.
 *
 * Ad slot IDs must match the div IDs you add to your HTML
 * (see INTEGRATION_GUIDE.html for the exact placement guide).
 */

(function () {
    'use strict';

    // ── Configuration ─────────────────────────────────────────────────────────

    // Map of slot-id → ad zone/placement id
    const AD_SLOTS = {
        'ad-rail-left': '',
        'ad-rail-right': '',
        'ad-strip-below-results': '',
    };

    // CSS class applied to every ad wrapper
    const WRAPPER_CLASS = 'ke-ad-slot';

    // ── Initialise ────────────────────────────────────────────────────────────

    async function init() {
        // Check premium status before rendering any ads
        const isPremium = typeof window.KePremium !== 'undefined'
            ? await window.KePremium.check()
            : false;

        if (isPremium) {
            _hideAllAds();
            return;
        }

        _renderSlots();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function _renderSlots() {
        Object.entries(AD_SLOTS).forEach(([slotId, zoneId]) => {
            const placeholder = document.getElementById(slotId);
            if (!placeholder) return;

            placeholder.classList.add(WRAPPER_CLASS);

            if (!zoneId) {
                // Keep existing fallback markup untouched when no direct network zone is configured
                return;
            }
        });
    }

    function _hideAllAds() {
        // Hide known slot elements
        Object.keys(AD_SLOTS).forEach(slotId => {
            const el = document.getElementById(slotId);
            if (el) {
                el.style.display = 'none';
                el.setAttribute('aria-hidden', 'true');
            }
        });

        // Also hide any existing ad containers/scripts for premium users
        document.querySelectorAll('.adsense-container, .adsbygoogle, [id^="adsense-"], [id*="monetag"], [class*="monetag"], iframe[src*="omg10.com"]')
            .forEach(el => {
                el.style.display = 'none';
                el.setAttribute('aria-hidden', 'true');
            });
    }

    // ── Auto-init ─────────────────────────────────────────────────────────────

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.KeAdSlots = { init, hideAllAds: _hideAllAds };

})();
