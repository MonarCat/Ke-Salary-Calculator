/**
 * api/public-actions.js
 *
 * Merged from api/feedback-form.js + api/request-password-reset.js +
 * api/ad-click/[id].js. Vercel's Hobby plan caps a deployment at 12
 * serverless functions; this project was sitting at exactly 12/12 with
 * these three previously separate.
 *
 * All three share the same auth posture -- fully public, no user session
 * or admin check required:
 *   - feedback-form relies only on an IP-based rate limit + honeypot.
 *   - request-password-reset intentionally never confirms whether an
 *     account exists (always returns GENERIC_SUCCESS), so there's no
 *     meaningful auth boundary to preserve either way.
 *   - ad-click is a bare redirect keyed by a public tracking id, no
 *     auth at all in the original.
 * That shared "no real auth surface" property is what makes consolidating
 * them behind one dispatcher safe -- unlike, say, mixing an admin-gated
 * route with a public one, which would have been a real risk.
 *
 * Routing: vercel.json rewrites the three original public URLs
 * (/api/feedback-form, /api/request-password-reset, /ad-click/:id) to
 * this file with a `_route` query param appended. The public URLs
 * themselves are UNCHANGED -- no frontend code needed to change at all.
 * `_route` is deliberately not named `action` to avoid any confusion
 * with request-password-reset's own body field also called `action`.
 *
 * All original behavior is preserved exactly, including each route's own
 * CORS/env-var/template logic. The one intentional change: the local
 * Brevo sender in the former request-password-reset.js is renamed from
 * `sendViaBrevo` to `sendPasswordResetBrevo` to avoid colliding with the
 * *different* `sendViaBrevo` imported from ./_lib/mailer.js for the
 * feedback route (different signature, different template, different
 * FROM_NAME default -- these are NOT interchangeable, so they are kept
 * as two separate functions rather than unified).
 *
 * See git history for each original file's full standalone header and
 * context if you need it.
 */

import { createClient } from '@supabase/supabase-js';
import { wrapInEmailShell, sendViaBrevo } from './_lib/mailer.js';

// ============================================================
// Shared across routes
// ============================================================
const SUPA_URL = process.env.SUPABASE_URL || 'https://wznopthjoaqusalqoyru.supabase.co';
const SVC_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_ORIGINS = new Set([
  'https://salarycalculator.co.ke',
  'https://www.salarycalculator.co.ke',
]);

function setCors(req, res) {
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.has(origin) ? origin : 'https://salarycalculator.co.ke');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

// ============================================================
// Route: feedback  (formerly api/feedback-form.js, unchanged)
// ============================================================
const FEEDBACK_RECIPIENT = process.env.FEEDBACK_RECIPIENT_EMAIL || 'adminkesalo@gmail.com';
const VALID_CATEGORIES = new Set(['feedback', 'comment', 'inquiry', 'suggestion', 'bug_report', 'other']);

// Simple in-memory rate limit -- resets on cold start, which is fine here:
// its purpose is only to blunt rapid automated spam bursts within one warm
// function instance, not to be a durable global limiter.
const recentSubmissions = new Map(); // ip -> timestamp[]
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX = 5;

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = (recentSubmissions.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  recentSubmissions.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT_MAX;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const CATEGORY_LABELS = {
  feedback: 'Feedback',
  comment: 'Comment',
  inquiry: 'Inquiry',
  suggestion: 'Suggestion',
  bug_report: 'Bug Report',
  other: 'Other',
};

async function handleFeedback(req, res) {
  try {
    return await runFeedback(req, res);
  } catch (fatalErr) {
    console.error('[public-actions/feedback] Unhandled error:', fatalErr);
    if (!res.headersSent) {
      setCors(req, res);
      return res.status(500).json({ error: 'Unexpected server error' });
    }
  }
}

async function runFeedback(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!SVC_KEY) return res.status(500).json({ error: 'Server misconfiguration' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many submissions. Please try again later.' });
  }

  const { name, email, category, message, website } = req.body || {};

  // Honeypot: a real user never fills a hidden field named "website".
  if (website) {
    return res.status(200).json({ success: true }); // pretend success, drop silently
  }

  const cleanName    = String(name || '').trim().slice(0, 200);
  const cleanEmail   = String(email || '').trim().slice(0, 320).toLowerCase();
  const cleanCategory = VALID_CATEGORIES.has(category) ? category : 'other';
  const cleanMessage = String(message || '').trim().slice(0, 5000);

  if (!cleanName || !cleanEmail || !cleanMessage) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(cleanEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const admin = createClient(SUPA_URL, SVC_KEY);

  const { error: insertErr } = await admin.from('feedback_submissions').insert({
    name: cleanName,
    email: cleanEmail,
    category: cleanCategory,
    message: cleanMessage,
    ip_address: ip,
    user_agent: String(req.headers['user-agent'] || '').slice(0, 500),
  });
  if (insertErr) {
    console.error('[public-actions/feedback] insert error:', insertErr.message);
    // Continue anyway -- still try to deliver the email even if the DB
    // record fails, so the admin doesn't lose the message entirely.
  }

  const categoryLabel = CATEGORY_LABELS[cleanCategory];

  try {
    await sendViaBrevo({
      to: FEEDBACK_RECIPIENT,
      toName: 'Salary Calculator Admin',
      subject: `[${categoryLabel}] New message from ${cleanName}`,
      htmlContent: wrapInEmailShell(`
        <p style="margin:0 0 12px"><strong>Category:</strong> ${escapeHtml(categoryLabel)}</p>
        <p style="margin:0 0 12px"><strong>From:</strong> ${escapeHtml(cleanName)} &lt;${escapeHtml(cleanEmail)}&gt;</p>
        <p style="margin:0 0 20px"><strong>Message:</strong></p>
        <p style="margin:0 0 20px;white-space:pre-wrap;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:16px">${escapeHtml(cleanMessage)}</p>
        <p style="margin:0;color:#667085;font-size:13px">Submitted via the contact form at salarycalculator.co.ke</p>
      `, { heading: 'New Contact Form Submission' }),
      replyTo: cleanEmail,
    });
  } catch (mailErr) {
    console.error('[public-actions/feedback] admin notification send failed:', mailErr.message);
    // The submission is already recorded in feedback_submissions above, so
    // this isn't a total loss -- but the client should know delivery was
    // not guaranteed.
    return res.status(200).json({
      success: true,
      warning: 'Your message was recorded but the email notification could not be sent immediately.',
    });
  }

  // Best-effort confirmation to the submitter -- failure here shouldn't
  // fail the whole request, the admin copy above already succeeded.
  sendViaBrevo({
    to: cleanEmail,
    toName: cleanName,
    subject: 'We received your message — Salary Calculator Kenya',
    htmlContent: wrapInEmailShell(`
      <p style="margin:0 0 16px">Hi ${escapeHtml(cleanName)},</p>
      <p style="margin:0 0 16px">Thanks for reaching out. We've received your ${escapeHtml(categoryLabel.toLowerCase())} and will get back to you as soon as we can.</p>
      <p style="margin:0;color:#667085;font-size:13px">This is an automated confirmation -- no need to reply to this email.</p>
    `, { heading: 'Message Received' }),
  }).catch((e) => console.error('[public-actions/feedback] submitter confirmation failed:', e.message));

  return res.status(200).json({ success: true });
}

// ============================================================
// Route: password-reset  (formerly api/request-password-reset.js, unchanged
// apart from the local Brevo sender being renamed to avoid colliding with
// the ./_lib/mailer.js sendViaBrevo used by the feedback route above)
// ============================================================
const BREVO_KEY_PWRESET  = process.env.BREVO_API_KEY;
const FROM_EMAIL_PWRESET = process.env.BREVO_SENDER_EMAIL || 'info@salarycalculator.co.ke';
const FROM_NAME_PWRESET  = process.env.BREVO_SENDER_NAME  || 'Salary Calculator Kenya';
const SITE_URL   = 'https://salarycalculator.co.ke';
const LOGO_URL   = `${SITE_URL}/logo.png`;

// Generic success reply -- never reveal whether the email exists
const GENERIC_SUCCESS = {
  success: true,
  message: 'If an account exists for that email, a password reset link has been sent.',
};

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
            <a href="mailto:${FROM_EMAIL_PWRESET}" style="color:#1a6b3c;text-decoration:none">${FROM_EMAIL_PWRESET}</a>
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

async function sendPasswordResetBrevo({ to, toName, subject, htmlContent }) {
  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': BREVO_KEY_PWRESET,
    },
    body: JSON.stringify({
      sender:      { name: FROM_NAME_PWRESET, email: FROM_EMAIL_PWRESET },
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

async function handlePasswordReset(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  // Env guard
  const missingVars = [];
  if (!SVC_KEY)             missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!BREVO_KEY_PWRESET)   missingVars.push('BREVO_API_KEY');
  if (missingVars.length) {
    console.error('[public-actions/password-reset] Missing env vars:', missingVars.join(', '));
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
      console.error('[public-actions/password-reset] generateLink error:', linkError.message);
      return res.status(200).json(GENERIC_SUCCESS);
    }

    const actionLink = data?.properties?.action_link;
    if (!actionLink) {
      console.error('[public-actions/password-reset] generateLink returned no action_link');
      return res.status(200).json(GENERIC_SUCCESS);
    }

    // Send the email via Brevo
    await sendPasswordResetBrevo({
      to:          email,
      toName:      email.split('@')[0],
      subject:     'Reset your Salary Calculator password',
      htmlContent: buildResetEmailHtml(actionLink),
    });

    return res.status(200).json(GENERIC_SUCCESS);
  } catch (err) {
    console.error('[public-actions/password-reset] unexpected error:', err.message);
    // Return generic success to avoid leaking internals to the client
    return res.status(200).json(GENERIC_SUCCESS);
  }
}

// ============================================================
// Route: ad-click  (formerly api/ad-click/[id].js, unchanged)
// ============================================================
function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader('Location', location);
  return res.end();
}

function getSafeHttpUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch (_) {
    return null;
  }
}

async function handleAdClick(req, res) {
  const id = String(req.query?.id || '').trim();
  if (!id || !SVC_KEY) return redirect(res, '/');

  const admin = createClient(SUPA_URL, SVC_KEY);

  try {
    const { data: booking, error } = await admin
      .from('ad_bookings')
      .select('id, click_url')
      .eq('id', id)
      .maybeSingle();

    if (error || !booking?.id || !booking?.click_url) return redirect(res, '/');
    const safeClickUrl = getSafeHttpUrl(booking.click_url);
    if (!safeClickUrl) return redirect(res, '/');

    await admin.rpc('increment_ad_click', { booking_id: booking.id });
    return redirect(res, safeClickUrl);
  } catch (_) {
    return redirect(res, '/');
  }
}

// ============================================================
// Dispatcher
// ============================================================
export default async function handler(req, res) {
  const route = req.query?._route;
  switch (route) {
    case 'feedback':        return handleFeedback(req, res);
    case 'password-reset':  return handlePasswordReset(req, res);
    case 'ad-click':        return handleAdClick(req, res);
    default:
      res.statusCode = 404;
      return res.end('Not found');
  }
}
