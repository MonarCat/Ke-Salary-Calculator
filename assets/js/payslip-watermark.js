/**
 * /assets/js/payslip-watermark.js
 *
 * Payslip download handler.
 *
 * All payslip downloads now use the normal print/download flow.
 */

/**
 * Attach the payslip download behaviour to a button.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} _supabase
 * @param {{ captureElementId?: string, downloadBtnId?: string }} opts
 */
export async function initPayslipDownload(_supabase, opts = {}) {
  const captureId = opts.captureElementId || "payslipOutput";
  const btnId     = opts.downloadBtnId    || "payslip-print-btn";

  await new Promise((r) => {
    if (document.readyState !== "loading") return r();
    document.addEventListener("DOMContentLoaded", r, { once: true });
  });

  const btn = document.getElementById(btnId);
  if (!btn) return;

  btn.addEventListener("click", (e) => {
    e.preventDefault();

    const captureEl = document.getElementById(captureId);
    if (!captureEl || captureEl.style.display === "none") {
      if (typeof window.printPayslip === "function") window.printPayslip();
      return;
    }

    if (typeof window.printPayslip === "function") {
      window.printPayslip();
    } else {
      window.print();
    }
  });
}
