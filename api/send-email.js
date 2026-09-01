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
const LOGO_URL   = 'https://salarycalculator.co.ke/logo.png';
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
  const referralLink = user.referral_code
    ? `https://salarycalculator.co.ke/auth.html?ref=${encodeURIComponent(user.referral_code)}`
    : 'https://salarycalculator.co.ke/account.html';
  return String(text || '')
    .replace(/\{\{name\}\}/g,           getName(user))
    .replace(/\{\{email\}\}/g,          user.email || '')
    .replace(/\{\{plan\}\}/g,           isPremium ? 'Premium' : 'Free')
    .replace(/\{\{expires\}\}/g,        expiry)
    .replace(/\{\{upgrade_link\}\}/g,   'https://salarycalculator.co.ke/#pricing')
    .replace(/\{\{referral_code\}\}/g,  user.referral_code || '(visit your account page)')
    .replace(/\{\{referral_link\}\}/g,  referralLink);
}

// ─── Email shell ───────────────────────────────────────────────────────────────
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
      You are receiving this email because you have an account at salarycalculator.co.ke.<br>
      <a href="https://salarycalculator.co.ke/account.html?unsubscribe=1" style="color:#98a2b3;text-decoration:underline">Unsubscribe</a>
      &nbsp;&middot;&nbsp;
      <a href="https://salarycalculator.co.ke/privacy-policy.html" style="color:#98a2b3;text-decoration:underline">Privacy Policy</a>
      &nbsp;&middot;&nbsp;
      <a href="https://salarycalculator.co.ke/terms-of-service.html" style="color:#98a2b3;text-decoration:underline">Terms of Use</a>
    </td></tr>
  </table>
</td></tr>`;

function wrapInEmailShell(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Salary Calculator Kenya</title></head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#1a1a1a">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:32px 12px">
  <tr><td align="center">
    <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border:1px solid #dbe5ef;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(16,24,40,0.08)">
      <tr><td style="background:#2a8a50;background-image:linear-gradient(135deg,#2f9a5a,#1a6b3c);padding:32px 24px;text-align:center;border-radius:18px 18px 0 0">
        <img src="${LOGO_URL}" alt="Salary Calculator" style="display:block;height:76px;width:auto;margin:0 auto 14px">
        <div style="font-size:28px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;font-family:Arial,sans-serif">Salary Calculator Premium</div>
        <div style="font-size:14px;color:rgba(255,255,255,0.86);margin-top:6px;font-family:Arial,sans-serif">Professional Payroll &amp; Payslip Tools for Kenya</div>
      </td></tr>
      <tr><td style="background:#ffffff;padding:40px 34px;font-size:15px;line-height:1.8;color:#1a2540">${bodyHtml}</td></tr>
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
    // Reply-to is the real, monitored admin inbox, not FROM_EMAIL
    // (info@salarycalculator.co.ke) -- a custom-domain monitored inbox
    // isn't paid for yet, and every template already points readers to
    // the Contact Us / Message Us form as the primary channel.
    replyTo: { email: 'adminkesalo@gmail.com' },
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
  try {
    return await handleSendEmail(req, res);
  } catch (fatalErr) {
    // Last-resort catch-all: without this, an unhandled exception anywhere
    // below crashes the whole serverless invocation and Vercel returns a
    // plain-text "FUNCTION_INVOCATION_FAILED" page instead of JSON, which is
    // what the admin dashboard was seeing (a parse error on the frontend).
    console.error('[send-email] Unhandled error:', fatalErr);
    if (!res.headersSent) {
      setCors(req, res);
      return res.status(500).json({ error: 'Unexpected server error: ' + (fatalErr?.message || String(fatalErr)) });
    }
  }
}

async function handleSendEmail(req, res) {
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
  const { template_key, subject, html_body, target, single_email, bulk_emails } = req.body || {};
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
    } else if (target === 'bulk') {
      // Arbitrary pasted addresses -- may or may not correspond to existing
      // registered users (mirrors the "prospects" use case: emailing leads,
      // not just customers). Never trust client-side extraction/dedup alone;
      // re-validate and re-cap server-side.
      const EMAIL_SHAPE_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
      const seen = new Set();
      const cleanEmails = [];
      for (const raw of Array.isArray(bulk_emails) ? bulk_emails : []) {
        const email = String(raw || '').trim().toLowerCase();
        if (!email || seen.has(email) || !EMAIL_SHAPE_RE.test(email)) continue;
        seen.add(email);
        cleanEmails.push(email);
        if (cleanEmails.length >= 250) break;
      }
      if (!cleanEmails.length) {
        return res.status(400).json({ error: 'bulk_emails must contain at least one valid email address' });
      }
      // Enrich with existing profile data where it exists, so {{name}}/
      // {{plan}}/{{expires}} personalise() correctly for known users too.
      const { data: matched, error: matchErr } = await admin
        .from('user_profiles').select('email, full_name, premium_expires_at, referral_code').in('email', cleanEmails);
      if (matchErr) throw matchErr;
      const byEmail = new Map((matched || []).map(u => [u.email?.toLowerCase(), u]));
      recipients = cleanEmails.map(email => {
        const profile = byEmail.get(email);
        return { ...(profile || {}), email, name: getName(profile || { email }) };
      });
    } else {
      const now = new Date().toISOString();
      let q = admin.from('user_profiles').select('id, email, full_name, premium_expires_at, referral_code');
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

  // ── Send in concurrent batches ───────────────────────────────────────────
  // Sending strictly one-at-a-time was slow enough that larger recipient
  // lists (e.g. "All Users") could run past the serverless function's max
  // execution time and get killed mid-request — which is what produced the
  // FUNCTION_INVOCATION_FAILED / unparseable-response error in the admin UI.
  // Sending each batch concurrently keeps the whole job well under that limit.
  let sent = 0, failed = 0;
  const errors = [];

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((r) => sendViaBrevo({
      to:          r.email,
      toName:      r.name,
      subject:     personalise(subject, r),
      htmlContent: wrapInEmailShell(personalise(html_body, r)),
    })));

    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        sent++;
      } else {
        failed++;
        const email = batch[idx].email;
        const message = result.reason?.message || String(result.reason);
        errors.push(`${email}: ${message}`);
        console.error('[send-email] failed:', email, message);
      }
    });

    if (i + BATCH_SIZE < recipients.length) {
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
