/**
 * /api/request-password-reset.js
 *
 * Public endpoint: generates a Supabase recovery link via the Admin API and
 * delivers it to the user over Brevo instead of relying on Supabase's built-in
 * SMTP (which returns 500 when it is misconfigured or quota-limited).
 *
 * Required Vercel env vars:
 *   SUPABASE_SERVICE_ROLE_KEY — service-role key (server-side only)
 *   BREVO_API_KEY             — Brevo transactional email API key
 *   BREVO_SENDER_EMAIL        — verified sender address
 *   BREVO_SENDER_NAME         — display name
 */

import { createClient } from '@supabase/supabase-js';

// ─── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = new Set([
  'https://salarycalculator.co.ke',
  'https://www.salarycalculator.co.ke',
]);

function setCors(req, res) {
  const origin = req.headers.origin || '';
  res.setHeader(
    'Access-Control-Allow-Origin',
    ALLOWED_ORIGINS.has(origin) ? origin : 'https://salarycalculator.co.ke',
  );
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

// ─── ENV ───────────────────────────────────────────────────────────────────────
const SUPA_URL   = 'https://wznopthjoaqusalqoyru.supabase.co';
const SVC_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BREVO_KEY  = process.env.BREVO_API_KEY;
const FROM_EMAIL = process.env.BREVO_SENDER_EMAIL || 'info@salarycalculator.co.ke';
const FROM_NAME  = process.env.BREVO_SENDER_NAME  || 'Salary Calculator Kenya';
const SITE_URL   = 'https://salarycalculator.co.ke';
const LOGO_URL   = `${SITE_URL}/logo.png`;

// ─── Generic success reply (never reveal whether the email exists) ──────────────
const GENERIC_SUCCESS = {
  success: true,
  message: 'If an account exists for that email, a password reset link has been sent.',
};

// ─── Email template ────────────────────────────────────────────────────────────
function buildResetEmailHtml(resetLink) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reset Your Password – Salary Calculator Kenya</title></head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#1a1a1a">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:32px 12px">
  <tr><td align="center">
    <table width="640" cellpadding="0" cellspacing="0"
           style="max-width:640px;width:100%;background:#ffffff;border:1px solid #dbe5ef;
                  border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(16,24,40,0.08)">
      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#2f9a5a,#1a6b3c);padding:32px 24px;
                     text-align:center;border-radius:18px 18px 0 0">
        <img src="${LOGO_URL}" alt="Salary Calculator" style="display:block;height:76px;width:auto;margin:0 auto 14px">
        <div style="font-size:28px;font-weight:700;color:#ffffff;letter-spacing:-0.5px">
          Salary Calculator Premium
        </div>
        <div style="font-size:14px;color:rgba(255,255,255,0.86);margin-top:6px">
          Professional Payroll &amp; Payslip Tools for Kenya
        </div>
      </td></tr>
      <!-- Body -->
      <tr><td style="padding:40px 34px;font-size:15px;line-height:1.8;color:#1a2540">
        <p style="margin-top:0">Hello,</p>
        <p>We received a request to reset the password for your Kenya Salary Calculator account.
           Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0">
          <tr><td align="center">
            <a href="${resetLink}"
               style="display:inline-block;background:#1a6b3c;color:#ffffff;font-size:16px;
                      font-weight:700;text-decoration:none;border-radius:8px;
                      padding:14px 32px;letter-spacing:0.3px">
              🔑 Reset My Password
            </a>
          </td></tr>
        </table>
        <p style="font-size:13px;color:#667085">
          Or copy and paste this link into your browser:<br>
          <a href="${resetLink}" style="color:#1a6b3c;word-break:break-all">${resetLink}</a>
        </p>
        <p style="font-size:13px;color:#667085;margin-bottom:0">
          If you did not request a password reset, you can safely ignore this email —
          your password will not change.
        </p>
      </td></tr>
      <!-- Footer -->
      <tr><td style="background:#f8fafc;border-top:1px solid #e5e7eb;border-radius:0 0 18px 18px;
                     padding:24px 30px">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="font-family:Arial,sans-serif;font-size:15px;font-weight:700;color:#111827">
            Salary Calculator Kenya
          </td></tr>
          <tr><td style="font-size:13px;color:#667085;padding-top:6px;line-height:1.8">
            Accurate Kenyan PAYE, SHIF, NSSF &amp; Payroll Tools
          </td></tr>
          <tr><td style="padding-top:12px;font-size:13px;line-height:1.9">
            <a href="${SITE_URL}" style="color:#1a6b3c;text-decoration:none">${SITE_URL.replace('https://', '')}</a><br>
            <a href="mailto:${FROM_EMAIL}" style="color:#1a6b3c;text-decoration:none">${FROM_EMAIL}</a>
          </td></tr>
          <tr><td style="padding-top:18px;font-size:11px;color:#98a2b3;line-height:1.7;text-align:center">
            &copy; ${new Date().getFullYear()} Salary Calculator Kenya. All rights reserved.<br>
            <a href="${SITE_URL}/privacy-policy.html" style="color:#98a2b3;text-decoration:underline">Privacy Policy</a>
            &nbsp;&middot;&nbsp;
            <a href="${SITE_URL}/terms-of-service.html" style="color:#98a2b3;text-decoration:underline">Terms of Use</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ─── Brevo send ────────────────────────────────────────────────────────────────
async function sendViaBrevo({ to, toName, subject, htmlContent }) {
  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': BREVO_KEY,
    },
    body: JSON.stringify({
      sender:      { name: FROM_NAME, email: FROM_EMAIL },
      to:          [{ email: to, name: toName || to }],
      subject,
      htmlContent,
      headers: {
        'X-Mailer': 'SC Password Reset',
      },
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => resp.statusText);
    throw new Error(`Brevo ${resp.status}: ${errText}`);
  }
}

// ─── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  // Env guard
  const missingVars = [];
  if (!SVC_KEY)   missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!BREVO_KEY) missingVars.push('BREVO_API_KEY');
  if (missingVars.length) {
    console.error('[request-password-reset] Missing env vars:', missingVars.join(', '));
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  // Validate input
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }

  try {
    const admin = createClient(SUPA_URL, SVC_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Generate a Supabase recovery link (server-side, no email sent by Supabase)
    const { data, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${SITE_URL}/reset-password.html`,
      },
    });

    if (linkError) {
      // Log internally but return generic success to avoid user enumeration
      console.error('[request-password-reset] generateLink error:', linkError.message);
      return res.status(200).json(GENERIC_SUCCESS);
    }

    const actionLink = data?.properties?.action_link;
    if (!actionLink) {
      console.error('[request-password-reset] generateLink returned no action_link');
      return res.status(200).json(GENERIC_SUCCESS);
    }

    // Send the email via Brevo
    await sendViaBrevo({
      to:          email,
      toName:      email.split('@')[0],
      subject:     'Reset your Salary Calculator password',
      htmlContent: buildResetEmailHtml(actionLink),
    });

    return res.status(200).json(GENERIC_SUCCESS);
  } catch (err) {
    console.error('[request-password-reset] unexpected error:', err.message);
    // Return generic success to avoid leaking internals to the client
    return res.status(200).json(GENERIC_SUCCESS);
  }
}
