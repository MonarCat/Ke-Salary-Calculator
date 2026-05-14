/**
 * /api/send-email.js
 *
 * Admin bulk / single email sender for salarycalculator.co.ke
 * Uses Brevo (sendinblue) SMTP API — no nodemailer, pure fetch.
 *
 * Required Vercel env vars:
 *   BREVO_API_KEY             — from Brevo dashboard → SMTP & API → API Keys
 *   BREVO_SENDER_EMAIL        — verified sender e.g. hello@salarycalculator.co.ke
 *   BREVO_SENDER_NAME         — display name  e.g. "Salary Calculator Kenya"
 *   SUPABASE_SERVICE_ROLE_KEY — service role key
 *   SUPABASE_ANON_KEY         — anon/public key
 *   ADMIN_EMAILS              — comma-separated admin email list
 */

import { createClient } from '@supabase/supabase-js';

// ─── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = new Set([
  'https://salarycalculator.co.ke',
  'https://www.salarycalculator.co.ke',
]);

function setCors(req, res) {
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.has(origin) ? origin : 'https://salarycalculator.co.ke');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}

// ─── ENV ──────────────────────────────────────────────────────────────────────
const SUPA_URL   = 'https://wznopthjoaqusalqoyru.supabase.co';
const SVC_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY   = process.env.SUPABASE_ANON_KEY;
const BREVO_KEY  = process.env.BREVO_API_KEY;
const FROM_EMAIL = process.env.BREVO_SENDER_EMAIL || 'info@salarycalculator.co.ke';
const FROM_NAME  = process.env.BREVO_SENDER_NAME  || 'Salary Calculator';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'kesalarycalculator@gmail.com')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

// Brevo free plan allows 300/day; keep batches safe
const BATCH_SIZE   = 50;   // recipients per Brevo API call (use BCC-style or individual)
const DELAY_MS     = 300;  // ms between batches

// ─── Helpers ──────────────────────────────────────────────────────────────────
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function getName(user) {
  const prefix = String(user?.email || 'there').split('@')[0];
  return String(user?.full_name || user?.display_name || user?.name || prefix).trim();
}

function personalise(text, user) {
  const expiry = user.premium_expires_at
    ? new Date(user.premium_expires_at).toLocaleDateString('en-KE', { year:'numeric', month:'long', day:'numeric' })
    : 'N/A';
  const isPremium = user.premium_expires_at && new Date(user.premium_expires_at) > new Date();
  return String(text || '')
    .replace(/\{\{name\}\}/g,         getName(user))
    .replace(/\{\{email\}\}/g,        user.email || '')
    .replace(/\{\{plan\}\}/g,         isPremium ? 'Premium' : 'Free')
    .replace(/\{\{expires\}\}/g,      expiry)
    .replace(/\{\{upgrade_link\}\}/g, 'https://salarycalculator.co.ke/#pricing');
}

// ─── Email shell (unchanged from original) ────────────────────────────────────
const EMAIL_FOOTER = `
<tr><td style="background:#f4f6f9;border-top:2px solid #e2e8f0;border-radius:0 0 12px 12px;padding:28px 40px">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="text-align:center;padding-bottom:16px">
      <div style="font-family:Arial,sans-serif;font-size:13px;font-weight:700;color:#00d4aa">⚡ Salary Calculator Kenya</div>
      <div style="font-size:11px;color:#8fa3c8;margin-top:3px;font-family:Arial,sans-serif">Kenya's most accurate payslip calculator · Powered by MonarCat</div>
    </td></tr>
    <tr><td style="background:#eef9f6;border:1px solid #c3ede6;border-radius:8px;padding:10px 16px;text-align:center">
      <div style="font-size:11px;color:#006b54;font-family:Arial,sans-serif;line-height:1.6"><strong>FY 2025/2026 Tax Rates Active</strong><br>PAYE (up to 35%) · NSSF Tier I &amp; II · SHIF 2.75% · Housing Levy 1.5%<br>Personal Relief: KES 2,400/month</div>
    </td></tr>
    <tr><td style="padding:12px 0"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #e2e8f0"></td></tr></table></td></tr>
    <tr><td style="text-align:center;padding-bottom:12px">
      <a href="https://salarycalculator.co.ke/calculator.html" style="font-size:12px;color:#00a88a;text-decoration:none;font-family:Arial,sans-serif;margin:0 8px">Calculator</a>
      <span style="color:#cbd5e1;font-size:12px">|</span>
      <a href="https://salarycalculator.co.ke/blog.html" style="font-size:12px;color:#00a88a;text-decoration:none;font-family:Arial,sans-serif;margin:0 8px">Blog</a>
      <span style="color:#cbd5e1;font-size:12px">|</span>
      <a href="https://salarycalculator.co.ke/account.html" style="font-size:12px;color:#00a88a;text-decoration:none;font-family:Arial,sans-serif;margin:0 8px">My Account</a>
      <span style="color:#cbd5e1;font-size:12px">|</span>
      <a href="https://salarycalculator.co.ke/contact-us.html" style="font-size:12px;color:#00a88a;text-decoration:none;font-family:Arial,sans-serif;margin:0 8px">Contact Us</a>
    </td></tr>
    <tr><td style="text-align:center">
      <div style="font-size:11px;color:#94a3b8;font-family:Arial,sans-serif;line-height:1.7">
        &copy; 2025 Salary Calculator Kenya &mdash; A MonarCat Product<br>
        Nairobi, Kenya &nbsp;&middot;&nbsp; Registered in Kenya<br><br>
        You are receiving this email because you have an account at salarycalculator.co.ke.<br>
        <a href="https://salarycalculator.co.ke/account.html?unsubscribe=1" style="color:#94a3b8;text-decoration:underline">Unsubscribe</a>
        &nbsp;&middot;&nbsp;
        <a href="https://salarycalculator.co.ke/privacy-policy.html" style="color:#94a3b8;text-decoration:underline">Privacy Policy</a>
        &nbsp;&middot;&nbsp;
        <a href="https://salarycalculator.co.ke/terms-of-service.html" style="color:#94a3b8;text-decoration:underline">Terms of Use</a>
      </div>
    </td></tr>
  </table>
</td></tr>`;

function wrapInEmailShell(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Salary Calculator Kenya</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Georgia,'Times New Roman',serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
      <tr><td style="background:#060b18;border-radius:12px 12px 0 0;padding:28px 40px;text-align:center">
        <div style="font-family:Arial,sans-serif;font-size:22px;font-weight:900;color:#00d4aa;letter-spacing:-0.5px">⚡ Salary Calculator Kenya</div>
        <div style="font-size:12px;color:#4f6280;margin-top:4px;font-family:Arial,sans-serif;letter-spacing:2px">SALARYCALCULATOR.CO.KE</div>
      </td></tr>
      <tr><td style="background:#ffffff;padding:40px;font-size:15px;line-height:1.8;color:#1a2540">${bodyHtml}</td></tr>
      ${EMAIL_FOOTER}
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ─── Brevo single send ────────────────────────────────────────────────────────
async function sendViaBrevo({ to, toName, subject, htmlContent }) {
  const body = {
    sender:  { name: FROM_NAME, email: FROM_EMAIL },
    to:      [{ email: to, name: toName || to }],
    subject,
    htmlContent,
    headers: {
      'List-Unsubscribe': '<https://salarycalculator.co.ke/account.html?unsubscribe=1>',
      'X-Mailer':         'SC Admin Dashboard',
    },
  };

  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key':      BREVO_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => resp.statusText);
    throw new Error(`Brevo ${resp.status}: ${errText}`);
  }
  return true;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  // ── Env guard — clear diagnostics per missing var ────────────────────────
  const missingVars = [];
  if (!SVC_KEY)   missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!ANON_KEY)  missingVars.push('SUPABASE_ANON_KEY');
  if (!BREVO_KEY) missingVars.push('BREVO_API_KEY');
  if (missingVars.length) {
    console.error('[send-email] Missing env vars:', missingVars.join(', '));
    return res.status(500).json({
      error: `Missing Vercel env vars: ${missingVars.join(', ')}. `
           + 'Add them at Vercel → Project → Settings → Environment Variables.',
    });
  }

  // ── Auth — wrap in try/catch (same fix as admin-ops.js) ─────────────────
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'No authorization token' });

  let caller;
  try {
    const callerSb       = createClient(SUPA_URL, ANON_KEY);
    const { data, error } = await callerSb.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: 'Invalid or expired session' });
    caller = data.user;
  } catch (authErr) {
    console.error('[send-email] getUser threw:', authErr);
    return res.status(401).json({ error: 'Authentication check failed' });
  }

  if (!ADMIN_EMAILS.includes(caller.email?.toLowerCase())) {
    return res.status(403).json({ error: 'Forbidden — admin only' });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  const { template_key, subject, html_body, target, single_email } = req.body || {};
  if (!subject?.trim() || !html_body?.trim()) {
    return res.status(400).json({ error: 'subject and html_body are required' });
  }

  const admin = createClient(SUPA_URL, SVC_KEY);

  // ── Build recipient list ───────────────────────────────────────────────────
  let recipients = [];
  try {
    if (target === 'single') {
      const email = String(single_email || '').trim().toLowerCase();
      if (!email) return res.status(400).json({ error: 'single_email is required for target=single' });
      const { data } = await admin.from('user_profiles').select('*').eq('email', email).maybeSingle();
      recipients = [{ ...(data || {}), email, name: getName(data || { email }) }];
    } else {
      const now = new Date().toISOString();
      let q = admin.from('user_profiles').select('id, email, full_name, premium_expires_at');
      if (target === 'premium') q = q.gt('premium_expires_at', now);
      else if (target === 'free') q = q.or(`premium_expires_at.is.null,premium_expires_at.lte.${now}`);
      const { data, error } = await q;
      if (error) throw error;
      recipients = (data || []).filter(u => !!u.email).map(u => ({ ...u, name: getName(u) }));
    }
  } catch (e) {
    console.error('[send-email] recipient fetch error:', e);
    return res.status(500).json({ error: 'Failed to fetch recipients: ' + e.message });
  }

  if (!recipients.length) {
    return res.json({ success: true, sent: 0, failed: 0, total: 0, message: 'No recipients in that segment' });
  }

  // ── Send in batches ────────────────────────────────────────────────────────
  let sent = 0, failed = 0;
  const errors = [];

  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    try {
      await sendViaBrevo({
        to:          r.email,
        toName:      r.name,
        subject:     personalise(subject, r),
        htmlContent: wrapInEmailShell(personalise(html_body, r)),
      });
      sent++;
    } catch (e) {
      failed++;
      errors.push(`${r.email}: ${e.message}`);
      console.error('[send-email] failed:', r.email, e.message);
    }

    // Rate-limit: pause between batches, not every single email
    if (recipients.length > 1 && (i + 1) % BATCH_SIZE === 0) {
      await delay(DELAY_MS);
    }
  }

  // ── Audit log ─────────────────────────────────────────────────────────────
  admin.from('email_send_log').insert({
    admin_email:      caller.email,
    template_key:     template_key || 'custom',
    subject,
    target_segment:   target || 'all',
    recipient_count:  sent,
    recipients:       recipients.slice(0, 100).map(r => r.email),
    status:           failed === 0 ? 'sent' : sent === 0 ? 'failed' : 'partial',
    error_message:    errors.length ? errors.slice(0, 5).join('; ') : null,
  }).catch(e => console.error('[send-email] audit log error:', e.message));

  return res.json({ success: true, sent, failed, total: recipients.length, errors: errors.slice(0, 3) });
}
