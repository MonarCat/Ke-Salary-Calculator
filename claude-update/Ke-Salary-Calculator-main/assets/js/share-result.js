/**
 * /assets/js/share-result.js
 *
 * Social sharing card for salary breakdown results.
 * Renders WhatsApp, X (Twitter), LinkedIn, copy-to-clipboard,
 * and save-as-image (html2canvas) share options.
 *
 * Usage:
 *   import { renderShareCard } from './share-result.js';
 *   renderShareCard('share-result-container', salaryDetail, 'salary-breakdown-table');
 *
 * salaryDetail shape: { gross, net, paye, nssf, shif, housing }
 */

// ── Format helpers ────────────────────────────────────────────────────────────

function _fmt(n) {
  return new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(n);
}

function _buildShareText(detail) {
  const { gross, net, paye, nssf, shif, housing } = detail;
  return (
    `*Kenya Salary Breakdown 🇰🇪*\n` +
    `Gross Pay:       KES ${_fmt(gross)}\n` +
    `PAYE Tax:        KES ${_fmt(paye)}\n` +
    `NSSF:            KES ${_fmt(nssf)}\n` +
    `SHIF:            KES ${_fmt(shif)}\n` +
    `Housing Levy:    KES ${_fmt(housing)}\n` +
    `━━━━━━━━━━━━━━━\n` +
    `*Net Pay:        KES ${_fmt(net)}*\n\n` +
    `Calculate yours 👉 https://salarycalculator.co.ke/calculator.html`
  );
}

// ── Sharing actions ───────────────────────────────────────────────────────────

function _shareWhatsApp(text) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}

function _shareX(text) {
  window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}

function _shareLinkedIn(detail) {
  const pageUrl = encodeURIComponent("https://salarycalculator.co.ke/calculator.html");
  const title   = encodeURIComponent("Kenya Salary Calculator 2025 – PAYE, NSSF & SHIF");
  const summary = encodeURIComponent(
    `I just calculated my net salary using the Kenya Salary Calculator. ` +
    `My net pay is KES ${_fmt(detail.net)} from a gross of KES ${_fmt(detail.gross)}.`
  );
  window.open(
    `https://www.linkedin.com/sharing/share-offsite/?url=${pageUrl}&title=${title}&summary=${summary}`,
    "_blank",
    "noopener,noreferrer"
  );
}

async function _copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0;";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand("copy");
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(ta);
    }
  }
}

function _saveImage(screenshotElementId) {
  const target = document.getElementById(screenshotElementId) ||
                 document.getElementById("results");
  if (!target) return;

  function doCapture(element) {
    window.html2canvas(element, {
      backgroundColor: "#ffffff",
      scale: 2,
      logging: false,
    }).then((canvas) => {
      const link = document.createElement("a");
      link.download = "ke-salary-breakdown.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    }).catch((err) => {
      console.error("[ShareResult] html2canvas error:", err);
    });
  }

  if (!window.html2canvas) {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
    script.onload = () => doCapture(target);
    document.head.appendChild(script);
  } else {
    doCapture(target);
  }
}

// ── Render ────────────────────────────────────────────────────────────────────

/**
 * Render the share card into a container element.
 *
 * @param {string} containerId         — ID of the element to render into.
 * @param {object} detail              — Salary detail: { gross, net, paye, nssf, shif, housing }
 * @param {string} [screenshotTarget]  — ID of element to screenshot for "Save Image".
 */
export function renderShareCard(containerId, detail, screenshotTarget) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const shareText = _buildShareText(detail);

  container.innerHTML = `
    <div class="sc-share">
      <h3 class="sc-share__heading">📤 Share Your Results</h3>
      <div class="sc-share__buttons">
        <button class="sc-share__btn sc-share__btn--whatsapp" data-action="whatsapp"
                aria-label="Share on WhatsApp">
          <svg class="sc-share__icon" viewBox="0 0 24 24" fill="currentColor"
               xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.553 4.116 1.522 5.847L0 24l6.335-1.502A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.893 0-3.67-.51-5.197-1.4l-.373-.222-3.761.893.943-3.663-.243-.379A10 10 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
          </svg>
          WhatsApp
        </button>
        <button class="sc-share__btn sc-share__btn--x" data-action="x"
                aria-label="Share on X">
          <svg class="sc-share__icon" viewBox="0 0 24 24" fill="currentColor"
               xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          X
        </button>
        <button class="sc-share__btn sc-share__btn--linkedin" data-action="linkedin"
                aria-label="Share on LinkedIn">
          <svg class="sc-share__icon" viewBox="0 0 24 24" fill="currentColor"
               xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          LinkedIn
        </button>
        <button class="sc-share__btn sc-share__btn--copy" data-action="copy"
                aria-label="Copy to clipboard">
          <svg class="sc-share__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
          Copy
        </button>
        <button class="sc-share__btn sc-share__btn--image" data-action="image"
                aria-label="Save as image">
          <svg class="sc-share__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          Save Image
        </button>
      </div>
      <span class="sc-share__feedback" id="sc-share-feedback" aria-live="polite"></span>
    </div>`;

  container.querySelector('[data-action="whatsapp"]').addEventListener("click", () =>
    _shareWhatsApp(shareText)
  );
  container.querySelector('[data-action="x"]').addEventListener("click", () =>
    _shareX(shareText)
  );
  container.querySelector('[data-action="linkedin"]').addEventListener("click", () =>
    _shareLinkedIn(detail)
  );
  container.querySelector('[data-action="copy"]').addEventListener("click", async () => {
    const ok = await _copyToClipboard(shareText);
    const fb = document.getElementById("sc-share-feedback");
    if (fb) {
      fb.textContent = ok ? "✓ Copied to clipboard!" : "✗ Copy failed – try manually.";
      setTimeout(() => { fb.textContent = ""; }, 3000);
    }
  });
  container.querySelector('[data-action="image"]').addEventListener("click", () =>
    _saveImage(screenshotTarget)
  );
}
