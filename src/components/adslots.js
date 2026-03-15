/**
 * adslots.js – Monetag ad placeholder management
 *
 * Creates standardised ad placeholder divs for Monetag to auto-fill.
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

    // Map of slot-id → Monetag zone/placement id
    // Replace the values with your actual Monetag zone IDs
    const AD_SLOTS = {
        'ke-ad-top':    '',   // e.g. '1234567'
        'ke-ad-mid':    '',
        'ke-ad-bottom': '',
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
                // Dev mode: show a labelled placeholder so you can see ad positions
                placeholder.innerHTML = `<div class="ke-ad-slot__placeholder">Ad – ${slotId}</div>`;
                return;
            }

            // Inject the Monetag async zone script
            const script = document.createElement('script');
            script.async = true;
            script.dataset.cfasync = 'false';
            script.src = `//pl${zoneId}.profitablegatecpm.com/${zoneId}/invoke.js`;
            placeholder.appendChild(script);
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

        // Also hide any existing AdSense / Monetag containers for premium users
        document.querySelectorAll('.adsense-container, .adsbygoogle, [id^="adsense-"]')
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
