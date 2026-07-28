/**
 * /assets/js/disclaimer-banner.js
 *
 * Site-wide updates notice banner.
 *
 * • Floating fixed banner at the top of every page.
 * • Dismissible via the ✕ button (stored in localStorage so it stays dismissed).
 * • Informs users of ongoing improvements, data safety, and how to reach us.
 *
 * Usage — add anywhere inside <body> (or just before </body>):
 *   <script src="/assets/js/disclaimer-banner.js"></script>
 */

(function () {
  var DISMISS_KEY = "sc_update_notice_dismissed";
  var BANNER_ID   = "sc-disclaimer-banner";

  // Don't show if user already dismissed
  if (localStorage.getItem(DISMISS_KEY) === "1") return;
  // Don't mount twice
  if (document.getElementById(BANNER_ID)) return;

  function mount() {
    if (document.getElementById(BANNER_ID)) return;

    var banner = document.createElement("div");
    banner.id = BANNER_ID;
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "polite");
    banner.style.cssText = [
      "position:fixed",
      "top:0",
      "left:0",
      "right:0",
      "z-index:99999",
      "background:#fffbeb",
      "border-bottom:3px solid #f59e0b",
      "padding:12px 16px",
      "font-size:0.875rem",
      "line-height:1.5",
      "color:#78350f",
      "display:flex",
      "align-items:flex-start",
      "justify-content:center",
      "gap:10px",
      "flex-wrap:wrap",
      "box-shadow:0 2px 8px rgba(0,0,0,0.15)",
    ].join(";");

    banner.innerHTML =
      '<span style="font-size:1.2rem;flex-shrink:0;margin-top:1px;">🔔</span>' +
      '<div style="flex:1;min-width:220px;max-width:860px;">' +
        '<strong>We\'re making KeSalary even better for you!</strong> ' +
        'Our platform is undergoing exciting improvements — you may notice that some features are temporarily unavailable or behaving differently. ' +
        '<strong>Your data is completely safe</strong> and all your information is secure throughout this process. ' +
        'These updates are designed to deliver greater value, including new tools and enhancements as part of our growth. ' +
        'Have a question or noticed something? ' +
        '<a href="/contact-us.html" ' +
           'style="color:#92400e;font-weight:600;text-decoration:underline;">' +
          'Reach out to us' +
        '</a> — we\'re happy to help!' +
      '</div>' +
      '<button id="sc-disclaimer-dismiss" ' +
        'aria-label="Dismiss notice" ' +
        'style="background:none;border:none;cursor:pointer;font-size:1.25rem;' +
               'color:#92400e;padding:0 4px;flex-shrink:0;line-height:1;' +
               'margin-top:1px;">&#x2715;</button>';

    // Push page content down so the banner doesn't cover it
    var spacer = document.createElement("div");
    spacer.id = BANNER_ID + "-spacer";
    spacer.setAttribute("aria-hidden", "true");

    function updateSpacer() {
      spacer.style.height = banner.offsetHeight + "px";
    }

    // Insert banner and spacer at the very top of <body>
    document.body.insertBefore(spacer, document.body.firstChild);
    document.body.insertBefore(banner, spacer);

    updateSpacer();
    window.addEventListener("resize", updateSpacer);

    document.getElementById("sc-disclaimer-dismiss").addEventListener("click", function () {
      banner.remove();
      spacer.remove();
      window.removeEventListener("resize", updateSpacer);
      localStorage.setItem(DISMISS_KEY, "1");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
}());
