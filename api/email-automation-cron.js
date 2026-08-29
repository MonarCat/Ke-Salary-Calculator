/**
 * api/email-automation-cron.js
 *
 * Scheduled job (see vercel.json "crons") that sends the lifecycle emails:
 *   welcome              -- new sign-ups
 *   premium_activated    -- premium purchase completed
 *   premium_expiring_3d  -- reminder ~3 days before premium_expires_at
 *   premium_expired      -- notice a few hours after premium_expires_at
 *   premium_offer_2d     -- offer to free users ~2 days after sign-up
 *
 * Deliberately does NOT hook into api/paystack-webhook.js (protected file).
 * Instead it reads user_profiles state directly -- premium_activated_at,
 * premium_expires_at, created_at -- so "premium activated" here just means
 * "we haven't emailed about the current premium_expires_at value yet",
 * regardless of what triggered the change (Paystack, admin grant, etc).
 *
 * Idempotency: for each (user_id, email_type, reference_value) we try to
 * INSERT into email_automation_log with ON CONFLICT DO NOTHING *before*
 * sending. Only send if that insert actually claimed a new row. This means
 * overlapping/retried cron runs can't double-send, even under concurrency.
 *
 * Required Vercel env vars (BREVO_* already exist for send-email.js):
 *   CRON_SECRET                -- shared secret Vercel Cron sends automatically
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { wrapInEmailShell, sendViaBrevo, getName } from './_lib/mailer.js';

const SUPA_URL = process.env.SUPABASE_URL || 'https://wznopthjoaqusalqoyru.supabase.co';
const SVC_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SITE = 'https://salarycalculator.co.ke';

// ─── Templates ──────────────────────────────────────────────────────────────
function welcomeEmail(user) {
  const name = getName(user);
  return {
    subject: `Welcome to Salary Calculator Kenya, ${name}!`,
    html: wrapInEmailShell(`
      <p style="margin:0 0 16px">Hi ${name},</p>
      <p style="margin:0 0 16px">Thanks for creating an account at Salary Calculator Kenya. You can now:</p>
      <ul style="margin:0 0 16px;padding-left:20px">
        <li>Get a full PAYE, NSSF, SHIF and Housing Levy breakdown of your salary</li>
        <li>Generate professional payslips</li>
        <li>Track payroll history and manage employees</li>
      </ul>
      <p style="margin:0 0 24px">
        <a href="${SITE}/calculator.html" style="background:#1a6b3c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Start Calculating</a>
      </p>
      <p style="margin:0;color:#667085">If you didn't create this account, you can safely ignore this email.</p>
    `, { heading: 'Welcome!' }),
  };
}

function premiumActivatedEmail(user) {
  const name = getName(user);
  const expiry = user.premium_expires_at
    ? new Date(user.premium_expires_at).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'N/A';
  return {
    subject: 'Your Premium subscription is active 🎉',
    html: wrapInEmailShell(`
      <p style="margin:0 0 16px">Hi ${name},</p>
      <p style="margin:0 0 16px">Your Premium subscription is now active. Thank you for supporting Salary Calculator Kenya!</p>
      <p style="margin:0 0 16px"><strong>Valid until:</strong> ${expiry}</p>
      <p style="margin:0 0 24px">
        <a href="${SITE}/account.html" style="background:#1a6b3c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">View Your Account</a>
      </p>
    `, { heading: 'Premium Activated' }),
  };
}

function premiumExpiringEmail(user) {
  const name = getName(user);
  const expiry = new Date(user.premium_expires_at).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });
  return {
    subject: 'Your Premium subscription expires in 3 days',
    html: wrapInEmailShell(`
      <p style="margin:0 0 16px">Hi ${name},</p>
      <p style="margin:0 0 16px">Your Premium subscription is set to expire on <strong>${expiry}</strong>.</p>
      <p style="margin:0 0 24px">Renew now to keep uninterrupted access to payslip generation, payroll history, and employee management.</p>
      <p style="margin:0 0 24px">
        <a href="${SITE}/account.html#pricing" style="background:#1a6b3c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Renew Premium</a>
      </p>
    `, { heading: 'Premium Expiring Soon' }),
  };
}

function premiumExpiredEmail(user) {
  const name = getName(user);
  return {
    subject: 'Your Premium subscription has expired',
    html: wrapInEmailShell(`
      <p style="margin:0 0 16px">Hi ${name},</p>
      <p style="margin:0 0 16px">Your Premium subscription has expired. You've been moved to the Free plan, so some features like unlimited payslips and payroll history are now limited.</p>
      <p style="margin:0 0 24px">
        <a href="${SITE}/account.html#pricing" style="background:#1a6b3c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Reactivate Premium</a>
      </p>
    `, { heading: 'Premium Expired' }),
  };
}

function premiumOfferEmail(user) {
  const name = getName(user);
  return {
    subject: 'A closer look at Salary Calculator Premium',
    html: wrapInEmailShell(`
      <p style="margin:0 0 16px">Hi ${name},</p>
      <p style="margin:0 0 16px">You've been using Salary Calculator Kenya for a couple of days now — hope it's been useful! Premium unlocks:</p>
      <ul style="margin:0 0 16px;padding-left:20px">
        <li>Unlimited payslip generation</li>
        <li>Payroll history &amp; reports</li>
        <li>P9A generation</li>
        <li>Employee management</li>
      </ul>
      <p style="margin:0 0 24px">
        <a href="${SITE}/account.html#pricing" style="background:#1a6b3c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">See Premium Plans</a>
      </p>
    `, { heading: 'Get More With Premium' }),
  };
}

// ─── Idempotent claim-then-send ────────────────────────────────────────────
async function claimAndSend(admin, user, emailType, referenceValue, buildEmail) {
  const { data: claimed, error: claimErr } = await admin
    .from('email_automation_log')
    .insert({ user_id: user.id, email_type: emailType, reference_value: referenceValue })
    .select('id')
    .maybeSingle();

  // Unique violation (23505) means another run already claimed/sent this --
  // not an error, just "skip".
  if (claimErr) {
    if (claimErr.code === '23505') return 'already_sent';
    console.error(`[email-automation-cron] claim failed for ${emailType}/${user.email}:`, claimErr.message);
    return 'claim_error';
  }
  if (!claimed) return 'already_sent';

  try {
    const { subject, html } = buildEmail(user);
    await sendViaBrevo({ to: user.email, toName: getName(user), subject, htmlContent: html });
    return 'sent';
  } catch (sendErr) {
    console.error(`[email-automation-cron] send failed for ${emailType}/${user.email}:`, sendErr.message);
    return 'send_error';
  }
}

async function runSegment(admin, users, emailType, referenceOf, buildEmail) {
  const counts = { sent: 0, already_sent: 0, claim_error: 0, send_error: 0 };
  for (const user of users) {
    if (!user.email) continue;
    const result = await claimAndSend(admin, user, emailType, referenceOf(user), buildEmail);
    counts[result] = (counts[result] || 0) + 1;
  }
  return counts;
}

// ─── Handler ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  try {
    return await run(req, res);
  } catch (fatalErr) {
    console.error('[email-automation-cron] Unhandled error:', fatalErr);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Unexpected server error: ' + (fatalErr?.message || String(fatalErr)) });
    }
  }
}

async function run(req, res) {
  // ── Auth: only Vercel Cron (or a manual call with the same secret) may trigger this ──
  const expected = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization || '';
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!SVC_KEY) {
    return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' });
  }

  const admin = createClient(SUPA_URL, SVC_KEY);
  const now = new Date();
  const results = {};

  // 1) Welcome -- signed up in the last 3 days (wide window: catches anyone
  //    missed by a prior run, idempotency prevents duplicates).
  {
    const since = new Date(now - 3 * 24 * 3600 * 1000).toISOString();
    const { data, error } = await admin
      .from('user_profiles')
      .select('id, email, full_name, created_at')
      .gte('created_at', since)
      .eq('is_banned', false);
    if (error) console.error('[email-automation-cron] welcome query error:', error.message);
    results.welcome = await runSegment(admin, data || [], 'welcome', () => '', welcomeEmail);
  }

  // 2) Premium activated -- currently premium, keyed by the current
  //    premium_expires_at so renewals get a fresh email.
  {
    const { data, error } = await admin
      .from('user_profiles')
      .select('id, email, full_name, premium_expires_at')
      .eq('premium', true)
      .not('premium_expires_at', 'is', null)
      .gt('premium_expires_at', now.toISOString())
      .eq('is_banned', false);
    if (error) console.error('[email-automation-cron] premium_activated query error:', error.message);
    results.premium_activated = await runSegment(
      admin, data || [], 'premium_activated',
      (u) => u.premium_expires_at, premiumActivatedEmail
    );
  }

  // 3) Premium expiring in ~3 days -- window covers 2.5-3.5 days out so a
  //    daily cron reliably catches each user exactly once.
  {
    const from = new Date(now.getTime() + 2.5 * 24 * 3600 * 1000).toISOString();
    const to   = new Date(now.getTime() + 3.5 * 24 * 3600 * 1000).toISOString();
    const { data, error } = await admin
      .from('user_profiles')
      .select('id, email, full_name, premium_expires_at')
      .eq('premium', true)
      .gte('premium_expires_at', from)
      .lte('premium_expires_at', to)
      .eq('is_banned', false);
    if (error) console.error('[email-automation-cron] premium_expiring_3d query error:', error.message);
    results.premium_expiring_3d = await runSegment(
      admin, data || [], 'premium_expiring_3d',
      (u) => u.premium_expires_at, premiumExpiringEmail
    );
  }

  // 4) Premium expired -- expired within the last 25 hours (slightly over a
  //    day so a daily cron can't miss the boundary).
  {
    const from = new Date(now.getTime() - 25 * 3600 * 1000).toISOString();
    const { data, error } = await admin
      .from('user_profiles')
      .select('id, email, full_name, premium_expires_at')
      .not('premium_expires_at', 'is', null)
      .gte('premium_expires_at', from)
      .lte('premium_expires_at', now.toISOString())
      .eq('is_banned', false);
    if (error) console.error('[email-automation-cron] premium_expired query error:', error.message);
    results.premium_expired = await runSegment(
      admin, data || [], 'premium_expired',
      (u) => u.premium_expires_at, premiumExpiredEmail
    );
  }

  // 5) Premium offer -- free users who signed up ~2 days ago (44-52h window
  //    so a daily cron reliably catches each user exactly once).
  {
    const from = new Date(now.getTime() - 52 * 3600 * 1000).toISOString();
    const to   = new Date(now.getTime() - 44 * 3600 * 1000).toISOString();
    const { data, error } = await admin
      .from('user_profiles')
      .select('id, email, full_name, created_at')
      .eq('premium', false)
      .gte('created_at', from)
      .lte('created_at', to)
      .eq('is_banned', false);
    if (error) console.error('[email-automation-cron] premium_offer_2d query error:', error.message);
    results.premium_offer_2d = await runSegment(
      admin, data || [], 'premium_offer_2d',
      () => '', premiumOfferEmail
    );
  }

  return res.status(200).json({ success: true, ran_at: now.toISOString(), results });
}
