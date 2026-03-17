/**
 * /assets/js/disclaimer-banner.js
 *
 * Site-wide maintenance notice banner.
 *
 * • Auto-expires at 2026-03-16T15:00:00Z (6 pm EAT) — never shows after that.
 * • Session-dismissible via the ✕ button.
 * • Shows which features are available right now.
 * • Does NOT reveal any internal implementation details.
 *
 * Usage — add near top of <body>:
 *   <script type="module" src="/assets/js/disclaimer-banner.js"></script>
 */

const EXPIRES_AT    = new Date("2026-03-16T15:00:00Z");
const DISMISS_KEY   = "sc_disclaimer_dismissed";
const BANNER_ID     = "sc-disclaimer-banner";

// Already past expiry — never show
if (Date.now() < EXPIRES_AT.getTime() && !sessionStorage.getItem(DISMISS_KEY)) {
  _mount();
}

function _mount() {
  if (document.getElementById(BANNER_ID)) return;

  const banner = document.createElement("div");
  banner.id = BANNER_ID;
  banner.setAttribute("role", "status");
  banner.setAttribute("aria-live", "polite");
  banner.style.cssText = [
    "position:relative",
    "z-index:8000",
    "background:#fffbeb",
    "border-bottom:2px solid #fbbf24",
    "padding:10px 16px",
    "font-size:0.85rem",
    "color:#78350f",
    "display:flex",
    "align-items:flex-start",
    "gap:10px",
    "flex-wrap:wrap",
  ].join(";");

  banner.innerHTML = `
    <span style="font-size:1.1rem;flex-shrink:0;">⚠️</span>
    <div style="flex:1;min-width:220px;">
      <strong>Brief scheduled maintenance underway.</strong>
      The following features are available right now:
      salary calculator, payslip generator, salary breakdowns, and blog articles.
      Some account and payment features may be temporarily unavailable.
      <br>
      <span style="color:#92400e;">On mobile? Switch to desktop view for the best experience during this window.</span>
    </div>
    <button id="sc-disclaimer-dismiss"
      aria-label="Dismiss notice"
      style="background:none;border:none;cursor:pointer;font-size:1.1rem;
             color:#92400e;padding:0 4px;flex-shrink:0;line-height:1;">✕</button>`;

  // Insert at the very top of <body>
  document.body.insertBefore(banner, document.body.firstChild);

  document.getElementById("sc-disclaimer-dismiss")?.addEventListener("click", () => {
    banner.remove();
    sessionStorage.setItem(DISMISS_KEY, "1");
  });
}
