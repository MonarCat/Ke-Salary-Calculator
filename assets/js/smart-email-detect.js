/**
 * smart-email-detect.js
 *
 * Self-applying live email-format detection for every input[type="email"]
 * on the page. Purely visual/UX feedback (a green check or red mark as the
 * user types) -- it never blocks form submission itself; each form keeps
 * its own required/validity checks.
 *
 * Pattern mirrors the bulk-paste smart extraction used in the admin Email
 * Center's "Paste Email List" box: same tolerant email-shape regex, just
 * applied to a single live field instead of extracting many from a blob.
 */
(function () {
    'use strict';

    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

    var CSS = `
.sed-wrap { position: relative; display: block; }
.sed-wrap input[type="email"] { padding-right: 34px !important; }
.sed-icon {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 15px;
    line-height: 1;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s;
}
.sed-icon.sed-show { opacity: 1; }
.sed-icon.sed-valid { color: #16a34a; }
.sed-icon.sed-invalid { color: #dc2626; }
input.sed-valid-border { border-color: #16a34a !important; }
input.sed-invalid-border { border-color: #dc2626 !important; }
body.dark-mode .sed-icon.sed-valid, [data-theme="dark"] .sed-icon.sed-valid { color: #4caf50; }
body.dark-mode .sed-icon.sed-invalid, [data-theme="dark"] .sed-icon.sed-invalid { color: #ef5350; }
`;

    function injectStyles() {
        if (document.getElementById('sed-styles')) return;
        var style = document.createElement('style');
        style.id = 'sed-styles';
        style.textContent = CSS;
        document.head.appendChild(style);
    }

    function wireInput(input) {
        if (input.dataset.sedWired) return;
        input.dataset.sedWired = '1';

        // Wrap the input so an icon can be absolutely positioned inside it,
        // without altering the input's own classes/attributes (so existing
        // form CSS/validation on the input itself is untouched).
        var parent = input.parentElement;
        var wrap = document.createElement('span');
        wrap.className = 'sed-wrap';
        parent.insertBefore(wrap, input);
        wrap.appendChild(input);

        var icon = document.createElement('span');
        icon.className = 'sed-icon';
        icon.setAttribute('aria-hidden', 'true');
        wrap.appendChild(icon);

        function update() {
            var val = input.value.trim();
            input.classList.remove('sed-valid-border', 'sed-invalid-border');
            icon.classList.remove('sed-show', 'sed-valid', 'sed-invalid');

            if (!val) return; // empty: no verdict shown yet

            if (EMAIL_RE.test(val)) {
                input.classList.add('sed-valid-border');
                icon.classList.add('sed-show', 'sed-valid');
                icon.textContent = '✓';
            } else {
                input.classList.add('sed-invalid-border');
                icon.classList.add('sed-show', 'sed-invalid');
                icon.textContent = '!';
            }
        }

        input.addEventListener('input', update);
        input.addEventListener('blur', update);
        update(); // handle any pre-filled value (e.g. browser autofill)
    }

    function applyToAll() {
        document.querySelectorAll('input[type="email"]').forEach(wireInput);
    }

    injectStyles();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyToAll);
    } else {
        applyToAll();
    }

    // Some forms on this site render their email input dynamically after
    // page load (e.g. the contact form mounts into a container via JS).
    // A lightweight MutationObserver catches those without every script
    // needing to know about this one.
    var observer = new MutationObserver(function () { applyToAll(); });
    observer.observe(document.body, { childList: true, subtree: true });
})();
