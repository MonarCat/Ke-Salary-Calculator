/**
 * calculator-enhancements.js – Single entry-point wiring script
 *
 * Add this to calculator.html with:
 *   <script type="module" src="src/components/calculator-enhancements.js"></script>
 *
 * Then add ONE line at the end of your existing calculateSalary() function
 * in assets/js/script.js (see comment in that file):
 *
 *   window.dispatchEvent(new CustomEvent('salaryCalculated', { detail: {
 *       grossPay, netPay, paye, nssf, shif, housingLevy, totalIncome
 *   }}));
 *
 * This file dynamically loads all component scripts and stylesheets,
 * so you only need a single <script> tag on the page.
 */

(function () {
    'use strict';

    // Base path relative to the HTML page that includes this script.
    // If your HTML is at root (e.g. calculator.html) and this file is at
    // src/components/, the base is 'src/components/'.
    const BASE = 'src/components/';

    // ── CSS files to inject ───────────────────────────────────────────────────
    const STYLESHEETS = [
        'premium-gate.css',
        'financial-tools.css',
        'share-result.css',
        'newsletter.css',
    ];

    // ── JS files to inject (order matters) ───────────────────────────────────
    const SCRIPTS = [
        'premium.js',        // must be first – others depend on KePremium
        'adslots.js',        // hides ads for premium; init() called on load
        'financial-tools.js',
        'share-result.js',
        'newsletter.js',
    ];

    // ── Inject stylesheets ────────────────────────────────────────────────────
    STYLESHEETS.forEach(file => {
        const link = document.createElement('link');
        link.rel  = 'stylesheet';
        link.href = BASE + file;
        document.head.appendChild(link);
    });

    // ── Inject scripts sequentially ───────────────────────────────────────────
    function loadNext(queue) {
        if (!queue.length) return;
        const [file, ...rest] = queue;
        const script = document.createElement('script');
        script.src   = BASE + file;
        script.defer = true;
        script.onload = () => loadNext(rest);
        document.body.appendChild(script);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => loadNext(SCRIPTS));
    } else {
        loadNext(SCRIPTS);
    }

})();
