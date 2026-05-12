import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': 'https://salarycalculator.co.ke',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

const SUPA_URL = 'https://wznopthjoaqusalqoyru.supabase.co';
const SVC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const envAnonKey = process.env.SUPABASE_ANON_KEY;
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'kesalarycalculator@gmail.com')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!SVC_KEY) {
    return res.status(500).json({ error: 'Server config missing SUPABASE_SERVICE_ROLE_KEY' });
  }

  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'No token' });

  const requestAnonKey = String(req.headers.apikey || '').trim();
  const callerKey = requestAnonKey || envAnonKey;
  if (!callerKey) {
    return res
      .status(500)
      .json({ error: 'Missing Supabase anon key: provide SUPABASE_ANON_KEY env or apikey header' });
  }

  const callerSb = createClient(SUPA_URL, callerKey);
  const {
    data: { user: caller },
  } = await callerSb.auth.getUser(token);

  if (!caller || !ADMIN_EMAILS.includes(caller.email?.toLowerCase())) {
    return res.status(403).json({ error: 'Forbidden — admin only' });
  }

  const admin = createClient(SUPA_URL, SVC_KEY);
  const { action, ...body } = req.body || {};

  const log = async (act, targetEmail, targetId, meta) => {
    await admin
      .from('admin_audit_log')
      .insert({
        admin_email: caller.email,
        action: act,
        target_email: targetEmail ?? null,
        target_id: targetId ?? null,
        metadata: meta ?? null,
      })
      .catch(() => {});
  };

  try {
    switch (action) {
      case 'get_analytics': {
        const [analytics, growth] = await Promise.all([
          admin.from('admin_analytics').select('*').single(),
          admin.from('admin_growth_daily').select('*').order('day', { ascending: true }),
        ]);
        if (analytics.error) throw analytics.error;
        return res.json({ analytics: analytics.data, growth: growth.data ?? [] });
      }

      case 'list_users': {
        const page = Math.max(1, Number(body.page ?? 1));
        const limit = Math.max(1, Math.min(200, Number(body.limit ?? 20)));
        const from = (page - 1) * limit;
        const { data, count, error } = await admin
          .from('user_profiles')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, from + limit - 1);
        if (error) throw error;
        return res.json({ users: data ?? [], total: count ?? 0, page, limit });
      }

      case 'grant_premium': {
        const { email, days, note } = body;
        if (!email || !days) {
          return res.status(400).json({ error: 'email and days required' });
        }
        const {
          data: { users },
          error: listErr,
        } = await admin.auth.admin.listUsers({ perPage: 1000 });
        if (listErr) throw listErr;

        const target = (users || []).find((u) => u.email?.toLowerCase() === String(email).toLowerCase());
        if (!target) {
          return res.status(404).json({ error: 'User not found — they must sign up first' });
        }
        const expires = new Date();
        expires.setDate(expires.getDate() + Number(days));

        const { error } = await admin.from('user_profiles').upsert(
          {
            id: target.id,
            email: target.email,
            premium_expires_at: expires.toISOString(),
            premium_source: 'admin',
            admin_note: note ?? null,
            p9a_access: true,
            payroll_access: true,
          },
          { onConflict: 'id' }
        );
        if (error) throw error;
        await log('grant_premium', email, target.id, { days, note });
        return res.json({ success: true, expires: expires.toISOString() });
      }

      case 'revoke_premium': {
        const { user_id, email } = body;
        const { error } = await admin
          .from('user_profiles')
          .update({ premium_expires_at: new Date().toISOString() })
          .eq('id', user_id);
        if (error) throw error;
        await log('revoke_premium', email, user_id);
        return res.json({ success: true });
      }

      case 'reset_password_email': {
        const { email } = body;
        const { data, error } = await admin.auth.admin.generateLink({
          type: 'recovery',
          email,
          options: { redirectTo: 'https://salarycalculator.co.ke/auth.html?mode=reset' },
        });
        if (error) throw error;
        await log('reset_password', email, undefined, { method: 'email' });
        return res.json({ success: true, link: data?.properties?.action_link });
      }

      case 'generate_reset_link': {
        const { email } = body;
        const { data, error } = await admin.auth.admin.generateLink({
          type: 'recovery',
          email,
          options: { redirectTo: 'https://salarycalculator.co.ke/auth.html?mode=reset' },
        });
        if (error) throw error;
        await log('reset_password', email, undefined, { method: 'link' });
        return res.json({ success: true, link: data?.properties?.action_link });
      }

      case 'set_password': {
        const { user_id, email, password } = body;
        if (!password || password.length < 8) {
          return res.status(400).json({ error: 'Password must be ≥ 8 characters' });
        }
        const { error } = await admin.auth.admin.updateUserById(user_id, { password });
        if (error) throw error;
        await log('set_password', email, user_id);
        return res.json({ success: true });
      }

      case 'generate_magic_link': {
        const { email } = body;
        const { data, error } = await admin.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: { redirectTo: 'https://salarycalculator.co.ke/calculator.html?sc_admin=1' },
        });
        if (error) throw error;
        await log('impersonate', email);
        return res.json({ success: true, link: data?.properties?.action_link });
      }

      case 'toggle_feature': {
        const { user_id, email, field, value } = body;
        const ALLOWED = ['p9a_access', 'payroll_access'];
        if (!ALLOWED.includes(field)) return res.status(400).json({ error: 'Invalid field' });
        const { error } = await admin
          .from('user_profiles')
          .update({ [field]: value })
          .eq('id', user_id);
        if (error) throw error;
        await log('toggle_feature', email, user_id, { field, value });
        return res.json({ success: true });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (e) {
    console.error('[admin-ops]', e);
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
}
