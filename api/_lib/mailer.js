/**
 * api/_lib/mailer.js
 *
 * Shared Brevo sender + branded HTML email shell, used by:
 *   - api/daily-cron.js  (lifecycle emails + referral qualification)
 *   - api/feedback-form.js          (contact form notifications)
 *
 * Deliberately NOT imported by api/send-email.js -- that file works today
 * and is left untouched. Some markup here is duplicated from it on purpose
 * to keep the blast radius of this change at zero for the existing admin
 * email center.
 *
 * Required Vercel env vars (already configured for send-email.js):
 *   BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME
 */

const BREVO_KEY  = process.env.BREVO_API_KEY;
const FROM_EMAIL = process.env.BREVO_SENDER_EMAIL || 'info@salarycalculator.co.ke';
const FROM_NAME  = process.env.BREVO_SENDER_NAME  || 'Salary Calculator';
const LOGO_URL   = 'https://salarycalculator.co.ke/logo.png';

const EMAIL_FOOTER = `
<tr><td style="background:#f8fafc;border-top:1px solid #e5e7eb;border-radius:0 0 18px 18px;padding:24px 30px">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="font-family:Arial,sans-serif;font-size:15px;font-weight:700;color:#111827">Salary Calculator Kenya</td></tr>
    <tr><td style="font-size:13px;color:#667085;padding-top:6px;line-height:1.8;font-family:Arial,sans-serif">Accurate Kenyan PAYE, SHIF, NSSF &amp; Payroll Tools</td></tr>
    <tr><td style="padding-top:12px;font-size:13px;line-height:1.9;font-family:Arial,sans-serif">
      <a href="https://salarycalculator.co.ke" style="color:#1a6b3c;text-decoration:none">salarycalculator.co.ke</a><br>
      <a href="https://salarycalculator.co.ke/contact-us.html" style="color:#1a6b3c;text-decoration:none;font-weight:600">Message Us / Feedback →</a>
    </td></tr>
    <tr><td style="padding-top:18px">
      <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #e5e7eb"></td></tr></table>
    </td></tr>
    <tr><td style="padding-top:18px;font-size:11px;color:#98a2b3;line-height:1.7;text-align:center;font-family:Arial,sans-serif">
      &copy; 2026 Salary Calculator Kenya. All rights reserved.<br>
      <a href="https://salarycalculator.co.ke/privacy-policy.html" style="color:#98a2b3;text-decoration:underline">Privacy Policy</a>
      &nbsp;&middot;&nbsp;
      <a href="https://salarycalculator.co.ke/terms-of-service.html" style="color:#98a2b3;text-decoration:underline">Terms of Use</a>
    </td></tr>
  </table>
</td></tr>`;

function wrapInEmailShell(bodyHtml, { heading = 'Salary Calculator', subheading = 'Accurate Kenyan Payroll &amp; Payslip Tools' } = {}) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Salary Calculator Kenya</title></head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#1a1a1a">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:32px 12px">
  <tr><td align="center">
    <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border:1px solid #dbe5ef;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(16,24,40,0.08)">
      <tr><td style="background:#2a8a50;background-image:linear-gradient(135deg,#2f9a5a,#1a6b3c);padding:32px 24px;text-align:center;border-radius:18px 18px 0 0">
        <img src="${LOGO_URL}" alt="Salary Calculator" style="display:block;height:76px;width:auto;margin:0 auto 14px">
        <div style="font-size:28px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;font-family:Arial,sans-serif">${heading}</div>
        <div style="font-size:14px;color:rgba(255,255,255,0.86);margin-top:6px;font-family:Arial,sans-serif">${subheading}</div>
      </td></tr>
      <tr><td style="background:#ffffff;padding:40px 34px;font-size:15px;line-height:1.8;color:#1a2540">${bodyHtml}</td></tr>
      ${EMAIL_FOOTER}
    </table>
  </td></tr>
</table>
</body></html>`;
}

const ADMIN_INBOX = 'adminkesalo@gmail.com'; // real, monitored -- see feedback-form.js

async function sendViaBrevo({ to, toName, subject, htmlContent, replyTo }) {
  if (!BREVO_KEY) throw new Error('BREVO_API_KEY is not configured');
  const body = {
    sender:  { name: FROM_NAME, email: FROM_EMAIL },
    to:      [{ email: to, name: toName || to }],
    subject,
    htmlContent,
    // Default reply-to is the real monitored admin inbox rather than
    // FROM_EMAIL (info@salarycalculator.co.ke), which isn't read -- a
    // custom-domain monitored inbox isn't paid for yet. Callers can still
    // override this (e.g. feedback-form.js sets it to the submitter's own
    // email so a reply reaches them directly, not the admin).
    replyTo: { email: replyTo || ADMIN_INBOX },
  };

  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': BREVO_KEY },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => resp.statusText);
    throw new Error(`Brevo ${resp.status}: ${errText}`);
  }
  return true;
}

function getName(user) {
  const prefix = String(user?.email || 'there').split('@')[0];
  return String(user?.full_name || user?.name || prefix).trim();
}

export { wrapInEmailShell, sendViaBrevo, getName, FROM_EMAIL, ADMIN_INBOX };
