/**
 * /api/prospects.js
 *
 * Merged from api/manage-prospects.js + api/send-campaign.js. Vercel's
 * Hobby plan caps a deployment at 12 serverless functions; adding both
 * files separately pushed this project to 13 and broke every deployment
 * (build failed outright, so NOTHING from that push went live, not just
 * this feature). Consolidating two closely-related files -- prospect
 * list CRUD and campaign-tracked sending to those same lists -- into one
 * router-style file with an `action` dispatch is the natural fix: same
 * feature area, same auth check, no reason they needed separate routes.
 *
 * All original behavior is preserved exactly; only the entry point and
 * the (now-shared, previously duplicated) auth check changed.
 *
 * Actions (POST body: { action, ...params }):
 *   list_lists              -> [{ id, name, created_at, email_count }]
 *   create_list   { name }  -> { id, name }
 *   rename_list   { list_id, name }
 *   delete_list   { list_id }              -- cascades prospects + prospect_sends
 *   add           { list_id, raw }         -- raw = pasted blob, smart-extracted
 *   list_emails   { list_id }              -> [{ id, email, created_at }]
 *   delete_email  { list_id, email }
 *   send_campaign { list_id, subject, html_body, batch_size, dry_run }
 *                 -- see the original send-campaign.js header comment
 *                    (reproduced below) for the full campaign-tracking
 *                    explanation
 *
 * ── Campaign tracking (formerly send-campaign.js) ───────────────────────
 * A "campaign" is identified by campaign_key = sha256(subject + '\0' +
 * html_body). Sending the SAME content to the same list again -- later
 * today, tomorrow, next week -- continues that campaign: only prospects
 * who haven't received this exact content yet are eligible, up to
 * batch_size. Editing the subject or body produces a different
 * campaign_key, so it's correctly treated as a new campaign against the
 * whole list. Only successfully-delivered sends are recorded in
 * prospect_sends -- anything Brevo rejects in a batch stays eligible for
 * the very next attempt automatically.
 *
 * IMPORTANT LIMITATION: sends happen sequentially within a single
 * serverless invocation, which has a hard execution timeout (see
 * vercel.json's maxDuration for this file). A very large batch_size
 * (approaching the 300 cap) could theoretically exceed that timeout
 * before finishing. This is safe (only successfully-recorded sends are
 * counted; interrupted work just retries on the next call), but the
 * response would never arrive, showing as a timeout error in the admin
 * UI rather than a clean "X sent" result. If this happens in practice,
 * use a smaller batch_size (e.g. 100) and click Send Batch multiple
 * times -- campaign tracking makes this exactly as safe as one large
 * batch, just more clicks.
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

const MAX_BATCH_SIZE = 300;
const DEFAULT_BATCH_SIZE = 250;
const SEND_DELAY_MS = 100;

// Same tolerant email-shape extraction used in admin.html's "Paste Email
// List" bulk-send box -- pulls every email-shaped substring out of any
// pasted blob, not just a clean comma/newline list.
const EMAIL_EXTRACT_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
function extractEmails(raw) {
  const matches = String(raw || '').match(EMAIL_EXTRACT_RE) || [];
  const seen = new Set();
  const out = [];
  for (const m of matches) {
    const e = m.toLowerCase();
    if (!seen.has(e)) { seen.add(e); out.push(e); }
  }
  return out;
}

async function campaignKey(subject, htmlBody) {
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
    console.error('[prospects] Unhandled error:', fatalErr);
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
    console.error('[prospects] getUser threw:', authErr);
    return res.status(401).json({ error: 'Authentication check failed' });
  }
  if (!ADMIN_EMAILS.includes(caller.email?.toLowerCase())) {
    return res.status(403).json({ error: 'Forbidden — admin only' });
  }

  const admin = createClient(SUPA_URL, SVC_KEY);
  const { action } = req.body || {};

  switch (action) {
    case 'list_lists':      return await listLists(admin, res);
    case 'create_list':     return await createList(admin, res, req.body);
    case 'rename_list':     return await renameList(admin, res, req.body);
    case 'delete_list':     return await deleteList(admin, res, req.body);
    case 'add':              return await addEmails(admin, res, req.body);
    case 'list_emails':     return await listEmails(admin, res, req.body);
    case 'delete_email':    return await deleteEmail(admin, res, req.body);
    case 'send_campaign':   return await sendCampaign(admin, res, req.body);
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
}

async function listLists(admin, res) {
  const { data: lists, error } = await admin
    .from('prospect_lists')
    .select('id, name, created_at')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const withCounts = await Promise.all((lists || []).map(async (list) => {
    const { count } = await admin
      .from('prospects')
      .select('id', { count: 'exact', head: true })
      .eq('list_id', list.id);
    return { ...list, email_count: count || 0 };
  }));

  return res.json({ success: true, lists: withCounts });
}

async function createList(admin, res, body) {
  const name = String(body?.name || '').trim().slice(0, 200);
  if (!name) return res.status(400).json({ error: 'List name is required' });

  const { data, error } = await admin
    .from('prospect_lists')
    .insert({ name })
    .select('id, name, created_at')
    .single();
  if (error) return res.status(500).json({ error: error.message });

  return res.json({ success: true, list: { ...data, email_count: 0 } });
}

async function renameList(admin, res, body) {
  const listId = body?.list_id;
  const name = String(body?.name || '').trim().slice(0, 200);
  if (!listId) return res.status(400).json({ error: 'list_id is required' });
  if (!name) return res.status(400).json({ error: 'name is required' });

  const { error } = await admin.from('prospect_lists').update({ name }).eq('id', listId);
  if (error) return res.status(500).json({ error: error.message });

  return res.json({ success: true });
}

async function deleteList(admin, res, body) {
  const listId = body?.list_id;
  if (!listId) return res.status(400).json({ error: 'list_id is required' });

  const { error } = await admin.from('prospect_lists').delete().eq('id', listId);
  if (error) return res.status(500).json({ error: error.message });

  return res.json({ success: true });
}

async function addEmails(admin, res, body) {
  const listId = body?.list_id;
  if (!listId) return res.status(400).json({ error: 'list_id is required' });

  const emails = extractEmails(body?.raw).slice(0, 2000);
  if (!emails.length) {
    return res.status(400).json({ error: 'No valid email addresses found in the pasted text' });
  }

  const rows = emails.map((email) => ({ list_id: listId, email }));
  const { error } = await admin
    .from('prospects')
    .upsert(rows, { onConflict: 'list_id,email', ignoreDuplicates: true });
  if (error) return res.status(500).json({ error: error.message });

  const { count } = await admin
    .from('prospects')
    .select('id', { count: 'exact', head: true })
    .eq('list_id', listId);

  return res.json({ success: true, added_count: emails.length, email_count: count || 0 });
}

async function listEmails(admin, res, body) {
  const listId = body?.list_id;
  if (!listId) return res.status(400).json({ error: 'list_id is required' });

  const { data, error } = await admin
    .from('prospects')
    .select('id, email, created_at')
    .eq('list_id', listId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  return res.json({ success: true, emails: data || [] });
}

async function deleteEmail(admin, res, body) {
  const listId = body?.list_id;
  const email = String(body?.email || '').trim().toLowerCase();
  if (!listId || !email) return res.status(400).json({ error: 'list_id and email are required' });

  const { error } = await admin.from('prospects').delete().eq('list_id', listId).eq('email', email);
  if (error) return res.status(500).json({ error: error.message });

  return res.json({ success: true });
}

async function sendCampaign(admin, res, body) {
  const { list_id, subject, html_body, batch_size, dry_run } = body || {};
  if (!list_id) return res.status(400).json({ error: 'list_id is required' });
  if (!subject?.trim() || !html_body?.trim()) {
    return res.status(400).json({ error: 'subject and html_body are required' });
  }

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
      });

      const { error: recordErr } = await admin
        .from('prospect_sends')
        .insert({ list_id, email, campaign_key: key });
      if (recordErr && recordErr.code !== '23505') {
        console.error('[prospects] record insert failed for', email, recordErr.message);
      }

      sentCount++;
    } catch (sendErr) {
      console.error('[prospects] send failed for', email, sendErr.message);
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
