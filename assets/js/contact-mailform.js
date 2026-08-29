/**
 * contact-mailform.js
 * Self-contained mailto contact form.
 * Renders into #sc-contact-form-container and opens the user's mail app.
 * Supports both body.dark-mode and [data-theme="dark"].
 */

(function () {
    'use strict';

    // ── Styles ──────────────────────────────────────────────────────────────
    const CSS = `
#sc-contact-form-container {
    font-family: inherit;
}
.scf-heading {
    color: #006600;
    margin-bottom: 8px;
    font-size: 1.6em;
}
.scf-subtitle {
    color: #666;
    margin-bottom: 25px;
    font-size: 0.95em;
}
.scf-form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
}
@media (max-width: 600px) {
    .scf-form-row { grid-template-columns: 1fr; }
}
.scf-form-group {
    margin-bottom: 18px;
}
.scf-form-group label {
    display: block;
    color: #333;
    font-weight: 600;
    margin-bottom: 6px;
    font-size: 0.95em;
}
.scf-form-group label i {
    color: #006600;
    margin-right: 6px;
    width: 14px;
}
.scf-form-group input,
.scf-form-group select,
.scf-form-group textarea {
    width: 100%;
    padding: 10px 12px;
    border: 1.5px solid #ddd;
    border-radius: 6px;
    font-size: 0.95em;
    font-family: inherit;
    color: #333;
    background: #fff;
    transition: border-color 0.2s, box-shadow 0.2s;
    box-sizing: border-box;
}
.scf-form-group input:focus,
.scf-form-group select:focus,
.scf-form-group textarea:focus {
    border-color: #006600;
    box-shadow: 0 0 0 3px rgba(0,102,0,0.1);
    outline: none;
}
.scf-form-group textarea {
    resize: vertical;
    min-height: 120px;
}
.scf-submit-btn {
    background: #006600;
    color: white;
    border: none;
    padding: 13px 35px;
    border-radius: 6px;
    font-size: 1em;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, transform 0.1s;
    display: inline-flex;
    align-items: center;
    gap: 8px;
}
.scf-submit-btn:hover {
    background: #005500;
}
.scf-submit-btn:active {
    transform: scale(0.98);
}
.scf-info {
    margin-top: 14px;
    padding: 12px 16px;
    border-radius: 8px;
    background: #e8f5e9;
    border: 1px solid #a5d6a7;
    color: #2e7d32;
    font-size: 0.9em;
    line-height: 1.5;
}
.scf-error {
    margin-top: 14px;
    padding: 12px 16px;
    border-radius: 8px;
    background: #fdecea;
    border: 1px solid #ef9a9a;
    color: #c62828;
    font-size: 0.9em;
    line-height: 1.5;
    display: none;
}

/* Dark-mode overrides — supports body.dark-mode (repo convention) and [data-theme="dark"] */
body.dark-mode .scf-heading,
[data-theme="dark"] .scf-heading {
    color: #4caf50;
}
body.dark-mode .scf-subtitle,
[data-theme="dark"] .scf-subtitle {
    color: #aaa;
}
body.dark-mode .scf-form-group label,
[data-theme="dark"] .scf-form-group label {
    color: #e0e0e0;
}
body.dark-mode .scf-form-group label i,
[data-theme="dark"] .scf-form-group label i {
    color: #4caf50;
}
body.dark-mode .scf-form-group input,
body.dark-mode .scf-form-group select,
body.dark-mode .scf-form-group textarea,
[data-theme="dark"] .scf-form-group input,
[data-theme="dark"] .scf-form-group select,
[data-theme="dark"] .scf-form-group textarea {
    background: #1a1a2e;
    color: #e0e0e0;
    border-color: #4caf50;
}
body.dark-mode .scf-form-group input:focus,
body.dark-mode .scf-form-group select:focus,
body.dark-mode .scf-form-group textarea:focus,
[data-theme="dark"] .scf-form-group input:focus,
[data-theme="dark"] .scf-form-group select:focus,
[data-theme="dark"] .scf-form-group textarea:focus {
    box-shadow: 0 0 0 3px rgba(76,175,80,0.2);
}
body.dark-mode .scf-submit-btn,
[data-theme="dark"] .scf-submit-btn {
    background: #4caf50;
    color: #1a1a2e;
}
body.dark-mode .scf-submit-btn:hover,
[data-theme="dark"] .scf-submit-btn:hover {
    background: #43a047;
}
body.dark-mode .scf-info,
[data-theme="dark"] .scf-info {
    background: #1b2e1b;
    border-color: #4caf50;
    color: #a5d6a7;
}
body.dark-mode .scf-error,
[data-theme="dark"] .scf-error {
    background: #2e1b1b;
    border-color: #ef9a9a;
    color: #ef9a9a;
}
`;

    // ── HTML ─────────────────────────────────────────────────────────────────
    const RECIPIENT = 'info@salarycalculator.co.ke';
    const API_ENDPOINT = '/api/feedback-form';

    const HTML = `
<h2 class="scf-heading"><i class="fas fa-paper-plane" style="color:#006600;"></i> Message Us / Feedback</h2>
<p class="scf-subtitle">Have feedback, a comment, an inquiry or a suggestion? We'd love to hear from you — fill in the form below and we'll get your message directly.</p>

<form id="scf-form" novalidate>
    <div class="scf-form-row">
        <div class="scf-form-group">
            <label for="scf-name"><i class="fas fa-user"></i> Your Name <span style="color:#cc0000;">*</span></label>
            <input type="text" id="scf-name" name="name" placeholder="John Doe" required autocomplete="name">
        </div>
        <div class="scf-form-group">
            <label for="scf-email"><i class="fas fa-envelope"></i> Your Email <span style="color:#cc0000;">*</span></label>
            <input type="email" id="scf-email" name="email" placeholder="john@example.com" required autocomplete="email">
        </div>
    </div>
    <div class="scf-form-group">
        <label for="scf-category"><i class="fas fa-tag"></i> Type <span style="color:#cc0000;">*</span></label>
        <select id="scf-category" name="category" required>
            <option value="">— Select a type —</option>
            <option value="feedback">Feedback</option>
            <option value="comment">Comment</option>
            <option value="inquiry">Inquiry</option>
            <option value="suggestion">Suggestion</option>
            <option value="bug_report">Bug Report</option>
            <option value="other">Other</option>
        </select>
    </div>
    <div class="scf-form-group">
        <label for="scf-message"><i class="fas fa-comment-alt"></i> Message <span style="color:#cc0000;">*</span></label>
        <textarea id="scf-message" name="message" placeholder="Please describe your feedback, comment, inquiry or suggestion in as much detail as possible…" required></textarea>
    </div>

    <!-- Honeypot: hidden from real users via CSS, bots often fill every field they can see in the DOM -->
    <div class="scf-form-group" style="position:absolute;left:-9999px;" aria-hidden="true">
        <label for="scf-website">Website</label>
        <input type="text" id="scf-website" name="website" tabindex="-1" autocomplete="off">
    </div>

    <button type="submit" class="scf-submit-btn">
        <i class="fas fa-paper-plane"></i> Send Message
    </button>

    <div class="scf-error" id="scf-error" role="alert" aria-live="polite"></div>
    <div class="scf-info" id="scf-info" style="display:none;" role="status">
        <i class="fas fa-check-circle"></i> <strong>Message sent — thank you!</strong>
        We've received your message and will get back to you if a reply is needed.
        You can also always reach us directly at
        <a href="mailto:${RECIPIENT}" style="color:inherit;font-weight:bold;">${RECIPIENT}</a>.
    </div>
</form>
`;

    function injectStyles() {
        if (document.getElementById('scf-styles')) return;
        const style = document.createElement('style');
        style.id = 'scf-styles';
        style.textContent = CSS;
        document.head.appendChild(style);
    }

    function showError(msg) {
        const el = document.getElementById('scf-error');
        if (!el) return;
        el.textContent = '';
        const icon = document.createElement('i');
        icon.className = 'fas fa-exclamation-circle';
        el.appendChild(icon);
        el.appendChild(document.createTextNode(' ' + msg));
        el.style.display = 'block';
    }

    function hideError() {
        const el = document.getElementById('scf-error');
        if (el) el.style.display = 'none';
    }

    function mount() {
        const container = document.getElementById('sc-contact-form-container');
        if (!container) return;

        injectStyles();
        container.innerHTML = HTML;

        // Wire any "go to form" anchor that points to #contact-form
        document.querySelectorAll('a[href="#contact-form"]').forEach(function (link) {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                container.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        });

        document.getElementById('scf-form').addEventListener('submit', async function (e) {
            e.preventDefault();

            const name     = document.getElementById('scf-name').value.trim();
            const email    = document.getElementById('scf-email').value.trim();
            const category = document.getElementById('scf-category').value;
            const message  = document.getElementById('scf-message').value.trim();
            const website  = document.getElementById('scf-website').value; // honeypot
            const info     = document.getElementById('scf-info');
            const submitBtn = e.target.querySelector('.scf-submit-btn');

            hideError();
            if (info) info.style.display = 'none';

            if (!name || !email || !category || !message) {
                showError('Please fill in all required fields.');
                return;
            }

            const emailInput = document.getElementById('scf-email');
            if (!emailInput.checkValidity()) {
                showError('Please enter a valid email address.');
                return;
            }

            const originalBtnHtml = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…';

            try {
                const resp = await fetch(API_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: name, email: email, category: category, message: message, website: website })
                });
                const data = await resp.json().catch(function () { return {}; });

                if (!resp.ok) {
                    showError(data.error || 'Something went wrong. Please try again or email us directly.');
                    return;
                }

                if (info) info.style.display = 'block';
                e.target.reset();
            } catch (err) {
                showError('Could not reach the server. Please check your connection and try again, or email us directly at ' + RECIPIENT + '.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHtml;
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        mount();
    }
})();
