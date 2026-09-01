/**
 * /api/send-welcome-email.js
 *
 * Sends the welcome email immediately at signup, rather than waiting for
 * the daily cron (api/daily-cron.js) to pick it up -- a welcome email
 * loses most of its point if it can arrive up to 24 hours late.
 *
 * Deliberately NOT admin-gated like the rest of the admin API surface --
 * this is called by a freshly-signed-up ordinary user, for themselves,
 * right after their own session is established. To keep that safe:
 *   - The caller's own session token is verified (same getUser() pattern
 *     as every other endpoint here), but there is no "target user" input
 *     at all -- this can only ever send to the token's own account, never
 *     to an arbitrary email or user_id supplied in the request body.
 *   - Idempotent via the SAME email_automation_log unique constraint the
 *     daily cron's claimAndSend() already relies on: (user_id, email_type,
 *     reference_value) is unique, so whichever of this endpoint or the
 *     daily cron claims the 'welcome' row first wins, and the other
 *     silently no-ops. Calling this endpoint repeatedly, accidentally or
 *     otherwise, can never send more than one welcome email per user.
 *
 * Required Vercel env vars (all already exist elsewhere in this project):
 *   SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
 *   BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME
 */

import { createClient } from '@supabase/supabase-js';
import { wrapInEmailShell, sendViaBrevo, getName } from './_lib/mailer.js';

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

const SUPA_URL = 'https://wznopthjoaqusalqoyru.supabase.co';
const SVC_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SITE = 'https://salarycalculator.co.ke';

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

export default async function handler(req, res) {
  try {
    return await run(req, res);
  } catch (fatalErr) {
    console.error('[send-welcome-email] Unhandled error:', fatalErr);
    if (!res.headersSent) {
      setCors(req, res);
      return res.status(500).json({ error: 'Unexpected server error: ' + (fatalErr?.message || String(fatalErr)) });
    }
  }
}

async function run(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!SVC_KEY || !ANON_KEY) {
    return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY' });
  }

  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'No authorization token' });

  let caller;
  try {
    const callerSb = createClient(SUPA_URL, ANON_KEY);
    const { data, error } = await callerSb.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: 'Invalid or expired session' });
    caller = data.user;
  } catch (authErr) {
    console.error('[send-welcome-email] getUser threw:', authErr);
    return res.status(401).json({ error: 'Authentication check failed' });
  }

  const admin = createClient(SUPA_URL, SVC_KEY);

  const { data: profile } = await admin
    .from('user_profiles')
    .select('id, email, full_name')
    .eq('id', caller.id)
    .maybeSingle();

  // Fall back to the auth user's own email/id if the profile row hasn't
  // been created yet (rare timing edge case, e.g. this call racing the
  // profile-creation trigger) -- still only ever targets the caller.
  const user = profile || { id: caller.id, email: caller.email };
  if (!user.email) {
    return res.status(400).json({ error: 'No email on this account' });
  }

  // Claim-then-send, identical idempotency contract to daily-cron.js's
  // claimAndSend() -- reference_value '' matches what the cron uses for
  // 'welcome', so whichever path gets there first is authoritative.
  const { data: claimed, error: claimErr } = await admin
    .from('email_automation_log')
    .insert({ user_id: user.id, email_type: 'welcome', reference_value: '' })
    .select('id')
    .maybeSingle();

  if (claimErr && claimErr.code !== '23505') {
    console.error('[send-welcome-email] claim failed:', claimErr.message);
    return res.status(500).json({ error: 'Could not process welcome email' });
  }
  if (!claimed) {
    // Already sent (either by a prior call to this endpoint, or by the
    // daily cron) -- not an error, just nothing further to do.
    return res.json({ success: true, already_sent: true });
  }

  try {
    const { subject, html } = welcomeEmail(user);
    await sendViaBrevo({ to: user.email, toName: getName(user), subject, htmlContent: html });
    return res.json({ success: true, sent: true });
  } catch (sendErr) {
    console.error('[send-welcome-email] send failed:', sendErr.message);
    // The claim is already recorded, so the daily cron won't retry this --
    // matches the same "rare miss requires a manual look" tradeoff already
    // accepted in the original cron design, rather than un-claiming and
    // risking a double-send race.
    return res.status(500).json({ error: 'Email could not be sent right now' });
  }
}
