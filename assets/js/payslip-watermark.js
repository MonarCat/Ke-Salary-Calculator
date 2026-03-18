/**
 * /assets/js/payslip-watermark.js
 *
 * Payslip download handler.
 *
 * FREE users  → html2canvas capture → diagonal "SAMPLE" watermark + red
 *               banner + dark footer → immediate PNG download → upgrade modal.
 * PREMIUM users → calls window.printPayslip() for the clean print/PDF flow.
 *
 * Usage:
 *   import { initPayslipDownload } from './payslip-watermark.js';
 *   initPayslipDownload(supabase, {
 *     captureElementId: 'payslipOutput',   // wraps the payslip UI
 *     downloadBtnId:    'payslip-print-btn', // the Download button
 *   });
 */

import {
  checkPremium,
  openPaystackCheckout,
  invalidatePremiumCache,
  showEmailCapture,
  PRICE_MONTHLY_KES,
  PRICE_YEARLY_KES,
  PRICE_SAVINGS_KES,
} from "./premium.js";

const HTML2CANVAS_CDN =
  "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";

// ── html2canvas loader ────────────────────────────────────────────────────────

function loadHtml2Canvas() {
  return new Promise((resolve, reject) => {
    if (window.html2canvas) return resolve(window.html2canvas);
    const s = document.createElement("script");
    s.src = HTML2CANVAS_CDN;
    s.onload  = () => resolve(window.html2canvas);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ── Watermark drawing ─────────────────────────────────────────────────────────

/**
 * Draw the SAMPLE watermark on a canvas element.
 * - Red top banner (12 % of height) with centred "SAMPLE" label.
 * - Diagonal "SAMPLE" across the full canvas.
 * - Dark semi-transparent footer with upgrade CTA text.
 */
function drawWatermark(canvas) {
  const ctx    = canvas.getContext("2d");
  const W      = canvas.width;
  const H      = canvas.height;
  const BANNER = Math.round(H * 0.12);
  const FOOTER = Math.round(H * 0.08);

  // Top banner
  ctx.fillStyle = "rgba(220,38,38,0.92)";
  ctx.fillRect(0, 0, W, BANNER);
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${Math.round(BANNER * 0.55)}px Arial,sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("⚠ SAMPLE — Upgrade for clean PDF", W / 2, BANNER / 2);

  // Diagonal "SAMPLE" text
  const diagSize = Math.round(Math.min(W, H) * 0.22);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-Math.atan2(H, W));
  ctx.font       = `bold ${diagSize}px Arial,sans-serif`;
  ctx.fillStyle  = "rgba(220,38,38,0.18)";
  ctx.textAlign  = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("SAMPLE", 0, 0);
  ctx.restore();

  // Dark footer
  ctx.fillStyle = "rgba(15,23,42,0.88)";
  ctx.fillRect(0, H - FOOTER, W, FOOTER);
  ctx.fillStyle  = "#cbd5e1";
  ctx.font       = `${Math.round(FOOTER * 0.38)}px Arial,sans-serif`;
  ctx.textAlign  = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    "salarycalculator.co.ke — Upgrade to Premium for clean, watermark-free payslips",
    W / 2,
    H - FOOTER / 2
  );
}

// ── PNG download trigger ──────────────────────────────────────────────────────

function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href     = url;
    link.download = filename || "payslip-sample.png";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, "image/png");
}

// ── Upgrade modal (shown immediately after free download) ─────────────────────

function showUpgradeModal() {
  document.getElementById("sc-upgrade-modal")?.remove();

  const modal = document.createElement("div");
  modal.id = "sc-upgrade-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "Upgrade to Premium");
  modal.style.cssText = [
    "position:fixed", "inset:0", "z-index:9998",
    "display:flex", "align-items:center", "justify-content:center",
    "background:rgba(0,0,0,0.60)", "padding:16px",
  ].join(";");

  modal.innerHTML = `
    <div style="
      background:#fff;border-radius:14px;padding:28px 24px;
      max-width:420px;width:100%;box-shadow:0 8px 48px rgba(0,0,0,0.28);
      text-align:center;position:relative;
    ">
      <button id="sc-upgrade-modal-close" aria-label="Close" style="
        position:absolute;top:12px;right:14px;background:none;border:none;
        font-size:1.3rem;cursor:pointer;color:#94a3b8;line-height:1;
      ">✕</button>

      <div style="font-size:2rem;margin-bottom:8px;">📄</div>
      <h3 style="margin:0 0 6px;font-size:1.15rem;font-weight:700;color:#0f172a;">
        Your SAMPLE payslip is downloading!
      </h3>
      <p style="margin:0 0 20px;font-size:0.88rem;color:#475569;">
        Upgrade to Premium to download clean, watermark-free payslips.
      </p>

      <div style="display:flex;gap:10px;justify-content:center;margin-bottom:20px;flex-wrap:wrap;">
        <div style="border:2px solid #e2e8f0;border-radius:10px;padding:12px 16px;min-width:130px;">
          <span style="display:block;font-size:0.75rem;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Monthly</span>
          <span style="display:block;font-size:1.4rem;font-weight:800;color:#0f172a;">KES ${PRICE_MONTHLY_KES.toLocaleString()}</span>
          <span style="display:block;font-size:0.75rem;color:#64748b;">/month</span>
        </div>
        <div style="border:2px solid #16a34a;border-radius:10px;padding:12px 16px;min-width:130px;
                    box-shadow:0 0 0 3px rgba(22,163,74,0.12);position:relative;">
          <span style="
            position:absolute;top:-10px;right:10px;
            background:#16a34a;color:#fff;font-size:0.65rem;font-weight:700;
            padding:2px 8px;border-radius:20px;
          ">Best Value</span>
          <span style="display:block;font-size:0.75rem;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Yearly</span>
          <span style="display:block;font-size:1.4rem;font-weight:800;color:#0f172a;">KES ${PRICE_YEARLY_KES.toLocaleString()}</span>
          <span style="display:block;font-size:0.75rem;color:#64748b;">/year</span>
          <span style="display:block;font-size:0.73rem;color:#16a34a;font-weight:600;margin-top:2px;">Save KES ${PRICE_SAVINGS_KES.toLocaleString()}</span>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;">
        <button id="sc-wm-pay-yearly" style="
          padding:12px 20px;background:#16a34a;color:#fff;border:none;
          border-radius:8px;font-size:0.95rem;font-weight:700;cursor:pointer;
        ">💳 Upgrade — KES ${PRICE_YEARLY_KES.toLocaleString()}/year</button>
        <button id="sc-wm-pay-monthly" style="
          padding:12px 20px;background:#fff;color:#16a34a;
          border:1.5px solid #16a34a;border-radius:8px;
          font-size:0.88rem;font-weight:600;cursor:pointer;
        ">Pay Monthly — KES ${PRICE_MONTHLY_KES.toLocaleString()}/mo</button>
        <a href="/account.html" style="
          padding:8px 12px;color:#64748b;font-size:0.8rem;text-decoration:none;
        ">Manage subscription →</a>
      </div>

      <p style="margin:14px 0 0;font-size:0.73rem;color:#94a3b8;">
        ✅ M-Pesa &amp; Card &nbsp;·&nbsp; ✅ Ad-free &nbsp;·&nbsp; ✅ Saved history
      </p>
    </div>`;

  document.body.appendChild(modal);

  function close() { modal.remove(); }
  modal.querySelector("#sc-upgrade-modal-close").addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });

  function launchPaystack(plan) {
    const email = window.__SC_USER_EMAIL;
    if (!email) {
      showEmailCapture(plan, (captured) => {
        window.__SC_USER_EMAIL = captured;
        openPaystackCheckout({
          plan,
          email: captured,
          onSuccess: () => { invalidatePremiumCache(); close(); window.location.href = "/premium-thank-you"; },
          onClose: () => {},
        });
      });
      return;
    }
    openPaystackCheckout({
      plan,
      email,
      onSuccess: () => { invalidatePremiumCache(); close(); window.location.href = "/premium-thank-you"; },
      onClose: () => {},
    });
  }

  modal.querySelector("#sc-wm-pay-yearly").addEventListener("click",   () => launchPaystack("yearly"));
  modal.querySelector("#sc-wm-pay-monthly").addEventListener("click",  () => launchPaystack("monthly"));
}

// ── Main init ─────────────────────────────────────────────────────────────────

/**
 * Attach the watermark download behaviour to a button.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ captureElementId?: string, downloadBtnId?: string }} opts
 */
export async function initPayslipDownload(supabase, opts = {}) {
  const captureId = opts.captureElementId || "payslipOutput";
  const btnId     = opts.downloadBtnId    || "payslip-print-btn";

  // Wait for DOM
  await new Promise((r) => {
    if (document.readyState !== "loading") return r();
    document.addEventListener("DOMContentLoaded", r, { once: true });
  });

  const btn = document.getElementById(btnId);
  if (!btn) return;

  btn.addEventListener("click", async (e) => {
    e.preventDefault();

    const captureEl = document.getElementById(captureId);
    if (!captureEl || captureEl.style.display === "none") {
      // Payslip not yet generated — let the existing alert run
      if (typeof window.printPayslip === "function") window.printPayslip();
      return;
    }

    const status = await checkPremium(supabase);
    if (status.email) window.__SC_USER_EMAIL = status.email;

    if (status.isPremium) {
      // Premium: clean print via existing function
      if (typeof window.printPayslip === "function") {
        window.printPayslip();
      } else {
        window.print();
      }
      return;
    }

    // Free user: capture + watermark + download + upgrade modal
    btn.disabled    = true;
    btn.textContent = "Generating sample…";

    try {
      const h2c    = await loadHtml2Canvas();
      const canvas = await h2c(captureEl, {
        scale:         2,
        useCORS:       true,
        allowTaint:    true,
        logging:       false,
        backgroundColor: "#ffffff",
      });

      drawWatermark(canvas);

      const employeeName = document.getElementById("slipName")?.textContent?.trim() || "payslip";
      const period       = document.getElementById("slipPeriod")?.textContent?.trim() || "";
      const rawFilename  = `payslip-SAMPLE-${employeeName}-${period}`
        .toLowerCase()
        .replace(/[^a-z0-9\-_.]/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, "");
      const filename = (rawFilename || "payslip-sample") + ".png";

      downloadCanvas(canvas, filename);
      showUpgradeModal();
    } catch (err) {
      console.error("[PayslipWatermark]", err);
      // Fall back to clean print if html2canvas fails
      if (typeof window.printPayslip === "function") window.printPayslip();
    } finally {
      btn.disabled    = false;
      btn.textContent = "Print/Download";
    }
  });
}
