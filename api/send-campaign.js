/**
 * /api/send-campaign.js
 *
 * Campaign-tracked batch sending to a prospect list, ported from
 * afams-web's Email Center. Solves the problem of Brevo's daily send cap:
 * a list of hundreds of addresses can't go out in one call, and naively
 * retrying tomorrow would re-email everyone including people who already
 * got it.
 *
 * A "campaign" is identified by campaign_key = sha256(subject + '\0' +
 * html_body). Sending the SAME content to the same list again -- later
 * today, tomorrow, next week -- continues that campaign: only prospects
 * who haven't received this exact content yet are eligible, up to
 * batch_size. Editing the subject or body produces a different
 * campaign_key, so it's correctly treated as a new campaign against the
 * whole list.
 *
 * Only successfully-delivered sends are recorded in prospect_sends --
 * anything Brevo rejects in a batch stays eligible for the very next
 * attempt automatically, no manual retry bookkeeping needed.
 *
 * IMPORTANT LIMITATION: sends happen sequentially within a single
 * serverless invocation, which has a hard execution timeout (see
 * vercel.json's maxDuration for this file, currently 120s). A very large
 * batch_size (approaching the 300 cap) could theoretically exceed that
 * timeout before finishing -- if that happens, Vercel kills the function
 * mid-batch. This is safe (only successfully-recorded sends are counted;
 * nothing gets double-sent since interrupted work just retries on the
 * next call), but the response would never arrive, showing as a timeout
 * error in the admin UI rather than a clean "X sent" result. If this
 * happens in practice, use a smaller batch_size (e.g. 100) and click
 * Send Batch multiple times -- the campaign tracking makes this exactly
 * as safe as one large batch, just more clicks.
 *
 * POST body:
 *   { list_id, subject, html_body, batch_size, dry_run }
 *
 * dry_run: true  -> { list_total, already_sent, remaining, will_send },
 *                    sends nothing
 * dry_run: false -> sends up to batch_size, records successes, returns
 *                    { sent, failed, remaining_after }
 *
 * Required Vercel env vars (all already exist for send-email.js):
 *   SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, ADMIN_EMAILS,
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
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'kesalarycalculator@gmail.com')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

// Brevo free/entry tier daily cap is commonly 300; leave headroom for
// transactional email (lifecycle automation, feedback form) sharing the
// same account, matching the cap already used for the admin "paste list"
// bulk-send target in send-email.js.
const MAX_BATCH_SIZE = 300;
const DEFAULT_BATCH_SIZE = 250;
// Reduced from an initial 300ms: this endpoint sends sequentially within a
// single serverless invocation, and Vercel functions have a hard execution
// timeout (see vercel.json maxDuration for this file). At 300 recipients,
// even a modest per-iteration delay compounds fast -- 300 x 300ms alone is
// 90s before any real network time is added. 100ms is still a reasonable
// pace against Brevo (sequential awaited calls already impose their own
// natural spacing from real network latency); it just avoids adding
// unnecessary time on top for large batches.
const SEND_DELAY_MS = 100;

async function campaignKey(subject, htmlBody) {
  // Web Crypto's crypto.subtle is available in Vercel's Node 18+ runtime,
  // so this ports from the Deno original with zero changes.
  const data = new TextEncoder().encode(String(subject) + '\u0000' + String(htmlBody));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async function handler(req, res) {
  try {
    return await run(req, res);
  } catch (fatalErr) {
    console.error('[send-campaign] Unhandled error:', fatalErr);
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

  // ── Auth: identical pattern to api/send-email.js ──────────────────────────
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'No authorization token' });

  let caller;
  try {
    const callerSb = createClient(SUPA_URL, ANON_KEY);
    const { data, error } = await callerSb.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: 'Invalid or expired session' });
    caller = data.user;
  } catch (authErr) {
    console.error('[send-campaign] getUser threw:', authErr);
    return res.status(401).json({ error: 'Authentication check failed' });
  }
  if (!ADMIN_EMAILS.includes(caller.email?.toLowerCase())) {
    return res.status(403).json({ error: 'Forbidden — admin only' });
  }

  const { list_id, subject, html_body, batch_size, dry_run } = req.body || {};
  if (!list_id) return res.status(400).json({ error: 'list_id is required' });
  if (!subject?.trim() || !html_body?.trim()) {
    return res.status(400).json({ error: 'subject and html_body are required' });
  }

  const admin = createClient(SUPA_URL, SVC_KEY);
  const key = await campaignKey(subject, html_body);

  const { data: allProspects, error: prospectsErr } = await admin
    .from('prospects')
    .select('email')
    .eq('list_id', list_id);
  if (prospectsErr) return res.status(500).json({ error: prospectsErr.message });

  const { data: sentRows, error: sentErr } = await admin
    .from('prospect_sends')
    .select('email')
    .eq('list_id', list_id)
    .eq('campaign_key', key);
  if (sentErr) return res.status(500).json({ error: sentErr.message });

  const alreadySent = new Set((sentRows || []).map((r) => r.email.toLowerCase()));
  const remaining = (allProspects || [])
    .map((p) => p.email.toLowerCase())
    .filter((email) => !alreadySent.has(email));

  const listTotal = (allProspects || []).length;

  if (dry_run) {
    return res.json({
      success: true,
      dry_run: true,
      campaign_key: key,
      list_total: listTotal,
      already_sent: alreadySent.size,
      remaining: remaining.length,
      will_send: Math.min(batch_size || DEFAULT_BATCH_SIZE, remaining.length),
    });
  }

  if (!remaining.length) {
    return res.json({
      success: true,
      sent: 0,
      failed: 0,
      remaining_after: 0,
      message: 'Everyone in this list has already received this exact campaign.',
    });
  }

  const effectiveBatchSize = Math.min(Number(batch_size) || DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE);
  const targets = remaining.slice(0, effectiveBatchSize);

  const wrappedHtml = wrapInEmailShell(html_body, { heading: 'Salary Calculator' });

  let sentCount = 0;
  let failedCount = 0;

  for (const email of targets) {
    try {
      const name = getName({ email });
      const personalizedHtml = wrappedHtml
        .replace(/\{\{\s*name\s*\}\}/gi, name)
        .replace(/\{\{\s*email\s*\}\}/gi, email);
      const personalizedSubject = subject
        .replace(/\{\{\s*name\s*\}\}/gi, name)
        .replace(/\{\{\s*email\s*\}\}/gi, email);

      await sendViaBrevo({
        to: email,
        toName: name,
        subject: personalizedSubject,
        htmlContent: personalizedHtml,
        // No replyTo passed -- inherits mailer.js's default of the real,
        // monitored admin inbox rather than an unmonitored custom-domain
        // address.
      });

      // Only record on confirmed success -- anything that throws above
      // never reaches this insert, so it stays eligible for the next
      // batch attempt with no separate retry bookkeeping required.
      const { error: recordErr } = await admin
        .from('prospect_sends')
        .insert({ list_id, email, campaign_key: key });
      if (recordErr && recordErr.code !== '23505') {
        // 23505 = unique violation, meaning it was already recorded by a
        // concurrent/overlapping request -- not a real failure.
        console.error('[send-campaign] record insert failed for', email, recordErr.message);
      }

      sentCount++;
    } catch (sendErr) {
      console.error('[send-campaign] send failed for', email, sendErr.message);
      failedCount++;
    }
    await sleep(SEND_DELAY_MS);
  }

  return res.json({
    success: true,
    sent: sentCount,
    failed: failedCount,
    remaining_after: remaining.length - sentCount,
  });
}
