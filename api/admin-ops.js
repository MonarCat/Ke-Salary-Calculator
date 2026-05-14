import { createClient } from '@supabase/supabase-js';

// ─── CORS ────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = new Set([
  'https://salarycalculator.co.ke',
  'https://www.salarycalculator.co.ke',
]);

function setCors(req, res) {
  const origin = req.headers.origin || '';
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://salarycalculator.co.ke';
  res.setHeader('Access-Control-Allow-Origin', allow);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');
  res.setHeader('Vary', 'Origin');
}

// ─── ENV ──────────────────────────────────────────────────────────────────────
const SUPA_URL   = 'https://wznopthjoaqusalqoyru.supabase.co';
const SVC_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const envAnonKey = process.env.SUPABASE_ANON_KEY;
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'kesalarycalculator@gmail.com')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

// ─── USER LIST COLUMNS ────────────────────────────────────────────────────────
const USER_LIST_COLUMNS = [
  'id', 'email', 'full_name', 'premium_expires_at', 'premium_source',
  'p9a_access', 'payroll_access', 'calculation_count', 'payslip_count',
  'last_active_at', 'created_at', 'is_banned', 'admin_note',
];
const OPTIONAL_USER_LIST_COLUMNS = new Set([
  'full_name', 'premium_source', 'p9a_access', 'payroll_access',
  'calculation_count', 'payslip_count', 'last_active_at', 'is_banned', 'admin_note',
]);

function findMissingOptionalColumn(error, columns) {
  const message = error?.message || '';
  return columns.find(c => OPTIONAL_USER_LIST_COLUMNS.has(c) && message.includes(c)) || null;
}

async function listUsersPage(admin, from, to, search = '') {
  let columns = [...USER_LIST_COLUMNS];
  while (columns.length) {
    let q = admin
      .from('user_profiles')
      .select(columns.join(', '), { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      q = q.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
    }

    const result = await q;
    const missingColumn = findMissingOptionalColumn(result.error, columns);
    if (!missingColumn) return result;
    columns = columns.filter(c => c !== missingColumn);
  }
  return { data: null, count: 0, error: { message: 'Failed to retrieve user profile data' } };
}

// ─── ANALYTICS ───────────────────────────────────────────────────────────────
function safeParseDate(value) {
  if (!value) return Number.NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function buildAnalytics(rows) {
  const nowTs      = Date.now();
  const weekAgoTs  = nowTs - 7  * 86400000;
  const monthAgoTs = nowTs - 30 * 86400000;
  const growthWin  = nowTs - 90 * 86400000;

  let totalUsers = 0, premiumUsers = 0, expiredUsers = 0;
  let newThisWeek = 0, newThisMonth = 0;
  let totalCalculations = 0, totalPayslips = 0, activeThisWeek = 0;
  const growthBuckets = new Map();

  for (const row of rows || []) {
    totalUsers++;
    totalCalculations += Number(row.calculation_count || 0);
    totalPayslips     += Number(row.payslip_count     || 0);

    const premTs    = safeParseDate(row.premium_expires_at);
    const isPremium = Number.isFinite(premTs) && premTs > nowTs;
    const isExpired = Number.isFinite(premTs) && premTs <= nowTs;
    if (isPremium) premiumUsers++;
    if (isExpired) expiredUsers++;

    const createdTs = safeParseDate(row.created_at);
    if (Number.isFinite(createdTs)) {
      const premSignup = Number.isFinite(premTs) && premTs > createdTs;
      if (createdTs > weekAgoTs)  newThisWeek++;
      if (createdTs > monthAgoTs) newThisMonth++;
      if (createdTs > growthWin) {
        const day    = new Date(createdTs).toISOString().slice(0, 10);
        const bucket = growthBuckets.get(day) || { day, signups: 0, premium_signups: 0 };
        bucket.signups++;
        if (premSignup) bucket.premium_signups++;
        growthBuckets.set(day, bucket);
      }
    }
    const lastActiveTs = safeParseDate(row.last_active_at);
    if (Number.isFinite(lastActiveTs) && lastActiveTs > weekAgoTs) activeThisWeek++;
  }

  return {
    analytics: {
      total_users: totalUsers, premium_users: premiumUsers,
      free_users: totalUsers - premiumUsers - expiredUsers,
      expired_users: expiredUsers, new_this_week: newThisWeek,
      new_this_month: newThisMonth, total_calculations: totalCalculations,
      total_payslips: totalPayslips, active_this_week: activeThisWeek,
    },
    growth: [...growthBuckets.values()].sort((a, b) => a.day.localeCompare(b.day)),
  };
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  // ── Env guards ──
  if (!SVC_KEY) {
    console.error('[admin-ops] SUPABASE_SERVICE_ROLE_KEY is not set in Vercel env vars');
    return res.status(500).json({
      error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is missing. '
           + 'Go to Vercel → Project → Settings → Environment Variables and add it.',
    });
  }

  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'No authorization token' });

  const requestAnonKey = String(req.headers.apikey || '').trim();
  const callerKey      = requestAnonKey || envAnonKey;
  if (!callerKey) {
    return res.status(500).json({
      error: 'Missing Supabase anon key — add SUPABASE_ANON_KEY to Vercel env vars '
           + 'or send it as the apikey header.',
    });
  }

  // ── FIX: wrap auth.getUser in try-catch — destructuring null data was causing unhandled 500s ──
  let caller;
  try {
    const callerSb       = createClient(SUPA_URL, callerKey);
    const { data, error } = await callerSb.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired session — please sign in again' });
    }
    caller = data.user;
  } catch (authErr) {
    console.error('[admin-ops] getUser threw:', authErr);
    return res.status(401).json({ error: 'Authentication check failed' });
  }

  if (!ADMIN_EMAILS.includes(caller.email?.toLowerCase())) {
    return res.status(403).json({ error: 'Forbidden — not an admin account' });
  }

  const admin              = createClient(SUPA_URL, SVC_KEY);
  const { action, ...body } = req.body || {};

  const log = async (act, targetEmail, targetId, meta) => {
    try {
      await admin.from('admin_audit_log').insert({
        admin_email:  caller.email,
        action:       act,
        target_email: targetEmail ?? null,
        target_id:    targetId   ?? null,
        metadata:     meta       ?? null,
      });
    } catch (_) { /* non-fatal — audit log failures must not break the action */ }
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  try {
    switch (action) {

      // ── Analytics ──────────────────────────────────────────────────────
      case 'get_analytics': {
        const { data, error } = await admin.from('user_profiles').select('*');
        if (error) throw error;
        return res.json(buildAnalytics(data));
      }

      // ── List / search users ────────────────────────────────────────────
      case 'list_users': {
        const page   = Math.max(1, Number(body.page  ?? 1));
        const limit  = Math.max(1, Math.min(200, Number(body.limit ?? 20)));
        const search = String(body.search || '').trim();
        const from   = (page - 1) * limit;
        const { data, count, error } = await listUsersPage(admin, from, from + limit - 1, search);
        if (error) throw error;
        return res.json({ users: data ?? [], total: count ?? 0, page, limit });
      }

      // ── Grant premium ──────────────────────────────────────────────────
      case 'grant_premium': {
        const { email, days, note } = body;
        if (!email || !days) return res.status(400).json({ error: 'email and days required' });

        const { data: { users }, error: listErr } =
          await admin.auth.admin.listUsers({ perPage: 1000 });
        if (listErr) throw listErr;

        const target = (users || []).find(u => u.email?.toLowerCase() === String(email).toLowerCase());
        if (!target) return res.status(404).json({ error: 'User not found — they must sign up first' });

        const expires = new Date();
        expires.setDate(expires.getDate() + Number(days));

        const { error } = await admin.from('user_profiles').upsert(
          { id: target.id, email: target.email, premium_expires_at: expires.toISOString(),
            premium_source: 'admin', admin_note: note ?? null, p9a_access: true, payroll_access: true },
          { onConflict: 'id' }
        );
        if (error) throw error;
        await log('grant_premium', email, target.id, { days, note });
        return res.json({ success: true, expires: expires.toISOString() });
      }

      // ── Bulk grant premium ─────────────────────────────────────────────
      case 'bulk_grant_premium': {
        const { user_ids, days, note } = body;
        if (!Array.isArray(user_ids) || !user_ids.length || !days) {
          return res.status(400).json({ error: 'user_ids array and days required' });
        }
        const expires = new Date();
        expires.setDate(expires.getDate() + Number(days));

        const upsertRows = user_ids.map(id => ({
          id, premium_expires_at: expires.toISOString(),
          premium_source: 'admin', admin_note: note ?? null,
          p9a_access: true, payroll_access: true,
        }));

        const { error } = await admin.from('user_profiles')
          .upsert(upsertRows, { onConflict: 'id' });
        if (error) throw error;
        await log('bulk_grant_premium', null, null, { user_ids, days, note, count: user_ids.length });
        return res.json({ success: true, updated: user_ids.length, expires: expires.toISOString() });
      }

      // ── Revoke premium ─────────────────────────────────────────────────
      case 'revoke_premium': {
        const { user_id, email } = body;
        if (!user_id) return res.status(400).json({ error: 'user_id required' });
        const { error } = await admin.from('user_profiles')
          .update({ premium_expires_at: new Date().toISOString() })
          .eq('id', user_id);
        if (error) throw error;
        await log('revoke_premium', email, user_id);
        return res.json({ success: true });
      }

      // ── Ban / unban user ───────────────────────────────────────────────
      case 'ban_user': {
        const { user_id, email } = body;
        if (!user_id) return res.status(400).json({ error: 'user_id required' });

        // Disable the auth account
        const { error: authErr } = await admin.auth.admin.updateUserById(user_id, {
          ban_duration: '876600h', // effectively permanent
        });
        if (authErr) throw authErr;

        const { error: dbErr } = await admin.from('user_profiles')
          .update({ is_banned: true }).eq('id', user_id);
        if (dbErr) throw dbErr;

        await log('ban_user', email, user_id);
        return res.json({ success: true });
      }

      case 'unban_user': {
        const { user_id, email } = body;
        if (!user_id) return res.status(400).json({ error: 'user_id required' });

        const { error: authErr } = await admin.auth.admin.updateUserById(user_id, {
          ban_duration: 'none',
        });
        if (authErr) throw authErr;

        const { error: dbErr } = await admin.from('user_profiles')
          .update({ is_banned: false }).eq('id', user_id);
        if (dbErr) throw dbErr;

        await log('unban_user', email, user_id);
        return res.json({ success: true });
      }

      // ── Update admin note ──────────────────────────────────────────────
      case 'update_note': {
        const { user_id, email, note } = body;
        if (!user_id) return res.status(400).json({ error: 'user_id required' });
        const { error } = await admin.from('user_profiles')
          .update({ admin_note: note ?? null }).eq('id', user_id);
        if (error) throw error;
        await log('update_note', email, user_id, { note });
        return res.json({ success: true });
      }

      // ── Password reset (send email) ────────────────────────────────────
      case 'reset_password_email': {
        const { email } = body;
        if (!email) return res.status(400).json({ error: 'email required' });
        const { data, error } = await admin.auth.admin.generateLink({
          type: 'recovery', email,
          options: { redirectTo: 'https://salarycalculator.co.ke/auth.html?mode=reset' },
        });
        if (error) throw error;
        await log('reset_password', email, undefined, { method: 'email' });
        return res.json({ success: true, link: data?.properties?.action_link });
      }

      // ── Generate reset link (copy) ─────────────────────────────────────
      case 'generate_reset_link': {
        const { email } = body;
        if (!email) return res.status(400).json({ error: 'email required' });
        const { data, error } = await admin.auth.admin.generateLink({
          type: 'recovery', email,
          options: { redirectTo: 'https://salarycalculator.co.ke/auth.html?mode=reset' },
        });
        if (error) throw error;
        await log('reset_password', email, undefined, { method: 'link' });
        return res.json({ success: true, link: data?.properties?.action_link });
      }

      // ── Set password directly ──────────────────────────────────────────
      case 'set_password': {
        const { user_id, email, password } = body;
        if (!user_id || !password) return res.status(400).json({ error: 'user_id and password required' });
        if (password.length < 8) return res.status(400).json({ error: 'Password must be ≥ 8 characters' });
        const { error } = await admin.auth.admin.updateUserById(user_id, { password });
        if (error) throw error;
        await log('set_password', email, user_id);
        return res.json({ success: true });
      }

      // ── Magic link (impersonate) ───────────────────────────────────────
      case 'generate_magic_link': {
        const { email } = body;
        if (!email) return res.status(400).json({ error: 'email required' });
        const { data, error } = await admin.auth.admin.generateLink({
          type: 'magiclink', email,
          options: { redirectTo: 'https://salarycalculator.co.ke/calculator.html?sc_admin=1' },
        });
        if (error) throw error;
        await log('impersonate', email, undefined, { link_generated: true });
        return res.json({ success: true, link: data?.properties?.action_link });
      }

      // ── Toggle feature flag ────────────────────────────────────────────
      case 'toggle_feature': {
        const { user_id, email, field, value } = body;
        const ALLOWED = ['p9a_access', 'payroll_access'];
        if (!user_id || !ALLOWED.includes(field)) return res.status(400).json({ error: 'Invalid field' });
        const { error } = await admin.from('user_profiles')
          .update({ [field]: value }).eq('id', user_id);
        if (error) throw error;
        await log('toggle_feature', email, user_id, { field, value });
        return res.json({ success: true });
      }

      // ── Audit log viewer ───────────────────────────────────────────────
      case 'get_audit_log': {
        const page  = Math.max(1, Number(body.page  ?? 1));
        const limit = Math.max(1, Math.min(100, Number(body.limit ?? 50)));
        const from  = (page - 1) * limit;

        const { data, count, error } = await admin
          .from('admin_audit_log')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, from + limit - 1);

        if (error) {
          // Table might not exist yet — return empty gracefully
          if (error.code === '42P01') return res.json({ entries: [], total: 0, page, limit });
          throw error;
        }
        return res.json({ entries: data ?? [], total: count ?? 0, page, limit });
      }

      // ── Send email (mirrors Edge Function; requires send-email.js to do delivery) ──
      case 'send_email': {
        // This action only logs the intent; actual delivery is in /api/send-email.js
        const { subject, target } = body;
        const now = new Date().toISOString();
        let q = admin.from('user_profiles').select('email, full_name, premium_expires_at');
        if (target === 'premium') q = q.gt('premium_expires_at', now);
        else if (target === 'free') q = q.or(`premium_expires_at.is.null,premium_expires_at.lte.${now}`);
        const { data: recipients, error } = await q;
        if (error) throw error;
        await log('send_email', null, null, { subject, target, recipient_count: recipients?.length ?? 0 });
        return res.json({ success: true, recipients_count: recipients?.length ?? 0 });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (e) {
    console.error('[admin-ops] unhandled error in action', action, e);
    return res.status(500).json({ error: e?.message || 'Internal server error' });
  }
}
