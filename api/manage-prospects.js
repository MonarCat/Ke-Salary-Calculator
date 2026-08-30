/**
 * /api/manage-prospects.js
 *
 * Admin-only CRUD for prospect lists, ported from afams-web's Email Center.
 * Mirrors api/send-email.js's exact auth pattern (Bearer session token ->
 * ADMIN_EMAILS check) so it's consistent with the rest of the admin API
 * surface, rather than introducing a second auth convention.
 *
 * Actions (POST body: { action, ...params }):
 *   list_lists              -> [{ id, name, created_at, email_count }]
 *   create_list   { name }  -> { id, name }
 *   rename_list   { list_id, name }
 *   delete_list   { list_id }              -- cascades prospects + prospect_sends
 *   add           { list_id, raw }         -- raw = pasted blob, smart-extracted
 *   list_emails   { list_id }              -> [{ id, email, created_at }]
 *   delete_email  { list_id, email }
 *
 * Required Vercel env vars (all already exist for send-email.js):
 *   SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, ADMIN_EMAILS
 */

import { createClient } from '@supabase/supabase-js';

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

// Same tolerant email-shape extraction used in admin.html's "Paste Email
// List" bulk-send box -- pulls every email-shaped substring out of any
// pasted blob (a directory page, a messy paragraph, whatever), not just a
// clean comma/newline list.
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

export default async function handler(req, res) {
  try {
    return await run(req, res);
  } catch (fatalErr) {
    console.error('[manage-prospects] Unhandled error:', fatalErr);
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
    console.error('[manage-prospects] getUser threw:', authErr);
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

  // Attach a count per list. Small admin-only table set, so N+1 here is fine
  // (not a hot path, not user-facing).
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

  // ON DELETE CASCADE on both prospects and prospect_sends handles cleanup.
  const { error } = await admin.from('prospect_lists').delete().eq('id', listId);
  if (error) return res.status(500).json({ error: error.message });

  return res.json({ success: true });
}

async function addEmails(admin, res, body) {
  const listId = body?.list_id;
  if (!listId) return res.status(400).json({ error: 'list_id is required' });

  const emails = extractEmails(body?.raw).slice(0, 2000); // generous cap for a paste, not a per-send cap
  if (!emails.length) {
    return res.status(400).json({ error: 'No valid email addresses found in the pasted text' });
  }

  const rows = emails.map((email) => ({ list_id: listId, email }));
  // ignoreDuplicates (ON CONFLICT DO NOTHING) rather than a merge/update --
  // there's nothing to update on a re-paste of the same address, just dedupe
  // against the unique(list_id, email) constraint. (Using the service role
  // key here bypasses RLS entirely regardless of which upsert variant is
  // used, unlike the anon-role newsletter_subscribers case.)
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
