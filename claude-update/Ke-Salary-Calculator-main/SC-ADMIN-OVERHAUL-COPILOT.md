# SC Admin — Complete Overhaul Implementation Guide
## GitHub Copilot Prompt · salarycalculator.co.ke
### Supabase Project: `wznopthjoaqusalqoyru` · Stack: Static HTML + Supabase + Vercel

---

## MISSION STATEMENT

Rewrite `admin.html` from scratch. The current version has infinite loops, broken
analytics, and non-functional admin operations. This prompt tells you exactly what
to build, in what order, with what code. Do not modify the existing file — create
a new `admin.html` that replaces it entirely.

**Root causes of the current infinite loops (do NOT repeat these):**

| Bug | Why it loops |
|-----|-------------|
| `onAuthStateChange` calling `loadAllData()` | Auth state fires on EVERY token refresh (every 60s) → re-fetches → re-renders → re-draws charts → re-subscribes |
| Chart re-init without destroy | `new Chart(canvas, ...)` called on an already-used canvas → Chart.js throws, triggers error handler, which reloads |
| `filterUsers()` mutating `filteredUsers` then calling `renderUsersTable()` which calls `filterUsers()` again | Circular render dependency |
| `setInterval` querying Supabase every 30s while real-time subscription ALSO updates | Double-update causing duplicate state |
| Missing `booted` flag | `init()` callable multiple times |

---

## PART 1 — SUPABASE SCHEMA

Run this SQL in **Supabase → SQL Editor** BEFORE writing any frontend code.

```sql
-- ============================================================
-- 1. user_profiles table (extend existing, don't recreate)
-- ============================================================
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS full_name        TEXT,
  ADD COLUMN IF NOT EXISTS p9a_access       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payroll_access   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS calculation_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payslip_count    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_active_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_note       TEXT,
  ADD COLUMN IF NOT EXISTS is_banned        BOOLEAN NOT NULL DEFAULT false;

-- Drop and recreate the CHECK constraint to include all valid sources
ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_premium_source_check;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_premium_source_check
  CHECK (premium_source IN (
    'paystack', 'mpesa', 'airtel', 'admin', 'easter_gift_2026', 'manual'
  ));

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_up_email    ON user_profiles (email);
CREATE INDEX IF NOT EXISTS idx_up_premium  ON user_profiles (premium_expires_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_up_created  ON user_profiles (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_up_active   ON user_profiles (last_active_at DESC NULLS LAST);

-- ============================================================
-- 2. admin_audit_log — every admin action is recorded
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email TEXT NOT NULL,
  action      TEXT NOT NULL,   -- 'grant_premium' | 'revoke_premium' | 'reset_password' | 'impersonate' | 'set_password' | 'toggle_feature' | 'send_email'
  target_email TEXT,
  target_id   UUID,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only service role can write; anon cannot read
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
-- No public RLS policies — service role bypasses RLS entirely

-- ============================================================
-- 3. Analytics VIEW — used by admin dashboard for real data
-- ============================================================
CREATE OR REPLACE VIEW admin_analytics AS
SELECT
  COUNT(*)                                                        AS total_users,
  COUNT(*) FILTER (WHERE premium_expires_at > now())             AS premium_users,
  COUNT(*) FILTER (WHERE premium_expires_at IS NULL
    OR premium_expires_at <= now())                              AS free_users,
  COUNT(*) FILTER (WHERE premium_expires_at <= now()
    AND premium_expires_at IS NOT NULL)                          AS expired_users,
  COUNT(*) FILTER (WHERE created_at > now() - INTERVAL '7 days') AS new_this_week,
  COUNT(*) FILTER (WHERE created_at > now() - INTERVAL '30 days') AS new_this_month,
  COALESCE(SUM(calculation_count), 0)                            AS total_calculations,
  COALESCE(SUM(payslip_count), 0)                                AS total_payslips,
  COUNT(*) FILTER (WHERE last_active_at > now() - INTERVAL '7 days') AS active_this_week
FROM user_profiles;

-- Grant SELECT to authenticated (admin reads this via anon key after auth)
GRANT SELECT ON admin_analytics TO authenticated;

-- ============================================================
-- 4. Growth chart data — daily signups for last 90 days
-- ============================================================
CREATE OR REPLACE VIEW admin_growth_daily AS
SELECT
  DATE_TRUNC('day', created_at)::DATE AS day,
  COUNT(*)                             AS signups,
  COUNT(*) FILTER (WHERE premium_expires_at > now()) AS premium_signups
FROM user_profiles
WHERE created_at > now() - INTERVAL '90 days'
GROUP BY 1
ORDER BY 1;

GRANT SELECT ON admin_growth_daily TO authenticated;

-- ============================================================
-- 5. RLS: authenticated users can only read their own profile
--    Service role (edge function) bypasses RLS entirely
-- ============================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_profile_select" ON user_profiles;
CREATE POLICY "own_profile_select" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "own_profile_update" ON user_profiles;
CREATE POLICY "own_profile_update" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admin reads ALL profiles via the edge function (service role) — no policy needed
```

---

## PART 2 — EDGE FUNCTION: `admin-ops`

**File:** `supabase/functions/admin-ops/index.ts`

Deploy: `supabase functions deploy admin-ops --project-ref wznopthjoaqusalqoyru`

**Secrets to set in Supabase Dashboard → Edge Functions → admin-ops → Secrets:**
- `SUPABASE_SERVICE_ROLE_KEY` → your service role key
- `ADMIN_EMAILS` → `kesalarycalculator@gmail.com` (comma-separated)

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

const ok  = (d: unknown) => new Response(JSON.stringify(d), { headers: CORS_HEADERS });
const err = (msg: string, s = 400) =>
  new Response(JSON.stringify({ error: msg }), { status: s, headers: CORS_HEADERS });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST")    return err("Method not allowed", 405);

  // --- Auth: verify caller is a valid logged-in admin ---
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
  const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
  const SVC_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ADMIN_EMAILS = (Deno.env.get("ADMIN_EMAILS") || "").split(",").map(e => e.trim().toLowerCase());

  // Use the caller's token to verify their session
  const callerClient = createClient(SUPA_URL, token);
  const { data: { user: caller } } = await callerClient.auth.getUser();
  if (!caller || !ADMIN_EMAILS.includes(caller.email?.toLowerCase() ?? "")) {
    return err("Forbidden", 403);
  }

  // Admin Supabase client — service role, bypasses RLS
  const admin = createClient(SUPA_URL, SVC_KEY);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err("Invalid JSON"); }

  const log = async (action: string, targetEmail?: string, targetId?: string, meta?: object) => {
    await admin.from("admin_audit_log").insert({
      admin_email: caller.email,
      action,
      target_email: targetEmail ?? null,
      target_id: targetId ?? null,
      metadata: meta ?? null,
    });
  };

  // ─── ROUTER ───────────────────────────────────────────────────────────────
  switch (body.action) {

    // GET ALL USERS (paginated)
    case "list_users": {
      const page  = Number(body.page  ?? 1);
      const limit = Number(body.limit ?? 50);
      const from  = (page - 1) * limit;

      const { data, error, count } = await admin
        .from("user_profiles")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, from + limit - 1);

      if (error) return err(error.message, 500);
      return ok({ users: data, total: count, page, limit });
    }

    // GET ANALYTICS
    case "get_analytics": {
      const [analytics, growth] = await Promise.all([
        admin.from("admin_analytics").select("*").single(),
        admin.from("admin_growth_daily").select("*").order("day", { ascending: true }),
      ]);
      if (analytics.error) return err(analytics.error.message, 500);
      return ok({ analytics: analytics.data, growth: growth.data ?? [] });
    }

    // GRANT PREMIUM
    case "grant_premium": {
      const { email, days, note } = body as { email: string; days: number; note?: string };
      if (!email || !days) return err("email and days required");

      // Find the user in auth.users
      const { data: { users }, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
      if (listErr) return err(listErr.message, 500);
      const target = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (!target) return err("User not found — they must have signed up first", 404);

      const expires = new Date();
      expires.setDate(expires.getDate() + Number(days));

      const { error: upErr } = await admin.from("user_profiles").upsert({
        id: target.id,
        email: target.email,
        premium_expires_at: expires.toISOString(),
        premium_source: "admin",
        admin_note: note ?? null,
        // Auto-grant feature access with premium
        p9a_access: true,
        payroll_access: true,
      }, { onConflict: "id" });

      if (upErr) return err(upErr.message, 500);
      await log("grant_premium", email, target.id, { days, note });
      return ok({ success: true, expires: expires.toISOString() });
    }

    // REVOKE PREMIUM
    case "revoke_premium": {
      const { user_id, email } = body as { user_id: string; email: string };
      if (!user_id) return err("user_id required");

      const { error } = await admin.from("user_profiles").update({
        premium_expires_at: new Date().toISOString(),
      }).eq("id", user_id);

      if (error) return err(error.message, 500);
      await log("revoke_premium", email, user_id);
      return ok({ success: true });
    }

    // RESET PASSWORD — sends Supabase recovery email automatically
    case "reset_password_email": {
      const { email } = body as { email: string };
      if (!email) return err("email required");

      const { data, error } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: "https://salarycalculator.co.ke/auth.html?mode=reset" },
      });
      if (error) return err(error.message, 500);
      await log("reset_password", email, undefined, { method: "email" });
      return ok({ success: true, link: data?.properties?.action_link });
    }

    // GENERATE RESET LINK — returns link without auto-sending email
    case "generate_reset_link": {
      const { email } = body as { email: string };
      if (!email) return err("email required");

      const { data, error } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: "https://salarycalculator.co.ke/auth.html?mode=reset" },
      });
      if (error) return err(error.message, 500);
      await log("reset_password", email, undefined, { method: "link" });
      return ok({ success: true, link: data?.properties?.action_link });
    }

    // SET PASSWORD DIRECTLY
    case "set_password": {
      const { user_id, email, password } = body as { user_id: string; email: string; password: string };
      if (!user_id || !password) return err("user_id and password required");
      if (password.length < 8)   return err("Password must be ≥ 8 characters");

      const { error } = await admin.auth.admin.updateUserById(user_id, { password });
      if (error) return err(error.message, 500);
      await log("set_password", email, user_id);
      return ok({ success: true });
    }

    // GENERATE MAGIC LINK — admin impersonation
    case "generate_magic_link": {
      const { email } = body as { email: string };
      if (!email) return err("email required");

      const { data, error } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: "https://salarycalculator.co.ke/calculator.html?sc_admin=1" },
      });
      if (error) return err(error.message, 500);
      await log("impersonate", email, undefined, { link_generated: true });
      return ok({ success: true, link: data?.properties?.action_link });
    }

    // TOGGLE FEATURE ACCESS
    case "toggle_feature": {
      const { user_id, email, field, value } = body as {
        user_id: string; email: string; field: string; value: boolean;
      };
      const ALLOWED = ["p9a_access", "payroll_access"];
      if (!user_id || !ALLOWED.includes(field)) return err("Invalid request");

      const { error } = await admin.from("user_profiles")
        .update({ [field]: value })
        .eq("id", user_id);
      if (error) return err(error.message, 500);
      await log("toggle_feature", email, user_id, { field, value });
      return ok({ success: true });
    }

    // SEND BROADCAST EMAIL (via Zoho SMTP — implement in separate send-email fn)
    case "send_email": {
      const { subject, body: emailBody, target } = body as {
        subject: string; body: string; target: "all" | "premium" | "free" | string;
      };
      // Fetch recipient list
      let query = admin.from("user_profiles").select("email, full_name, premium_expires_at");
      if (target === "premium") query = query.gt("premium_expires_at", new Date().toISOString());
      else if (target === "free") query = query.or(`premium_expires_at.is.null,premium_expires_at.lte.${new Date().toISOString()}`);
      // else: all users or single email passed as target

      const { data: recipients, error } = await query;
      if (error) return err(error.message, 500);

      // TODO: loop through recipients and call Zoho SMTP or Brevo API here
      // For now, return the count so the frontend can confirm
      await log("send_email", undefined, undefined, { subject, target, recipient_count: recipients?.length ?? 0 });
      return ok({ success: true, recipients_count: recipients?.length ?? 0 });
    }

    default:
      return err(`Unknown action: ${body.action}`);
  }
});
```

---

## PART 3 — `admin.html` COMPLETE REWRITE

Write the file from scratch. Follow every rule below precisely.

### 3A — Architecture Rules (prevents infinite loops)

```
RULE 1: One init, one guard, one boot.
  - A single `let booted = false` flag at the top.
  - `init()` sets `booted = true` on first run and never runs again.
  - DO NOT call `init()` anywhere except the final line of the script.

RULE 2: Auth handled ONCE via getSession(), not onAuthStateChange().
  - Call `supabase.auth.getSession()` once at startup.
  - If no session → show login form.
  - If session exists → call `boot()` once.
  - Use `onAuthStateChange` ONLY to handle SIGNED_OUT event (to redirect to login).
    On SIGNED_IN or TOKEN_REFRESHED: do NOTHING — boot already ran.

RULE 3: Charts have a lifecycle object.
  - `const charts = {};`
  - Before drawing any chart: `if (charts.growth) { charts.growth.destroy(); }`
  - Then: `charts.growth = new Chart(...)`.
  - Never call `new Chart(canvas)` without destroying first.

RULE 4: Data loading uses a loading flag.
  - `let loading = false;`
  - `async function loadData() { if (loading) return; loading = true; ... loading = false; }`
  - Prevents parallel fetches.

RULE 5: No setInterval for Supabase queries.
  - Refresh button is the only way to reload data.
  - No polling. No real-time subscriptions in admin (overkill, causes reconnect loops).

RULE 6: Render functions are pure — they only read state, never write it.
  - `renderUsersTable()` reads `state.filteredUsers` — never modifies it.
  - `filterUsers()` writes `state.filteredUsers` then calls `renderUsersTable()`.
  - These two functions NEVER call each other.
```

### 3B — State Object

```javascript
// Single source of truth — no scattered globals
const state = {
  users: [],           // raw from admin-ops list_users
  filteredUsers: [],   // after search/filter applied
  analytics: null,     // from admin_analytics view
  growth: [],          // daily growth array
  filter: 'all',       // 'all' | 'premium' | 'free' | 'expired'
  searchQuery: '',
  page: 1,
  pageSize: 20,
  totalUsers: 0,
  selectedIds: new Set(),
  adminUser: null,     // current admin's Supabase user object
};

const charts = {};    // chart instances keyed by name
let booted = false;
let loading = false;
```

### 3C — Init Function (no loops)

```javascript
const SUPA_URL  = 'https://wznopthjoaqusalqoyru.supabase.co';
const ANON_KEY  = 'YOUR_ANON_KEY'; // replace
const ADMIN_FN  = `${SUPA_URL}/functions/v1/admin-ops`;
const { createClient } = supabase;
const sb = createClient(SUPA_URL, ANON_KEY);

async function init() {
  if (booted) return;
  booted = true;

  startClock();

  // Single auth check — no listeners, no loops
  const { data: { session } } = await sb.auth.getSession();

  if (!session) {
    hideLoading();
    showLoginForm();
    return;
  }

  // Listen ONLY for sign-out (token refresh must NOT trigger boot again)
  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      window.location.reload();
    }
    // SIGNED_IN and TOKEN_REFRESHED: intentionally ignored
  });

  state.adminUser = session.user;
  await boot();
}

async function boot() {
  hideLoading();
  showDashboard();
  renderAdminProfile();
  await loadData();
}
```

### 3D — Data Loading (single fn, no re-entrant)

```javascript
async function loadData() {
  if (loading) return;
  loading = true;
  showLoadingSpinner();

  try {
    // ONE round-trip to get analytics + growth
    const analyticsResp = await callAdminFn({ action: 'get_analytics' });
    if (analyticsResp.error) throw new Error(analyticsResp.error);
    state.analytics = analyticsResp.analytics;
    state.growth    = analyticsResp.growth;

    // Load first page of users
    await loadUsers(1);

    // Render everything
    renderStats();
    renderCharts();
    renderActivityFeed();

  } catch (e) {
    showToast('Error loading data: ' + e.message, 'error');
    console.error(e);
  } finally {
    loading = false;
    hideLoadingSpinner();
  }
}

async function loadUsers(page = 1) {
  const resp = await callAdminFn({
    action: 'list_users',
    page,
    limit: state.pageSize,
  });
  if (resp.error) throw new Error(resp.error);
  state.users = resp.users;
  state.totalUsers = resp.total;
  state.page = page;
  applyFilter(); // sets state.filteredUsers, then renderUsersTable()
}

// The ONLY function that sets filteredUsers — never called by renderUsersTable
function applyFilter() {
  const q = state.searchQuery.toLowerCase();
  state.filteredUsers = state.users.filter(u => {
    const planMatch =
      state.filter === 'all'     ? true :
      state.filter === 'premium' ? isPremiumActive(u) :
      state.filter === 'expired' ? isPremiumExpired(u) :
      /* free */                   !u.premium_expires_at && !isPremiumExpired(u);
    const searchMatch = !q ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.full_name || '').toLowerCase().includes(q);
    return planMatch && searchMatch;
  });
  renderUsersTable(); // one-directional: filter → render
}

// Helpers
function isPremiumActive(u)  { return u.premium_expires_at && new Date(u.premium_expires_at) > new Date(); }
function isPremiumExpired(u) { return u.premium_expires_at && new Date(u.premium_expires_at) <= new Date(); }
```

### 3E — Chart Rendering (destroy before recreate)

```javascript
function renderCharts() {
  renderGrowthChart();
  renderPlanChart();
  renderRevenueChart();
}

function renderGrowthChart() {
  const canvas = document.getElementById('growthChart');
  if (!canvas) return;

  // ALWAYS destroy before recreating — prevents Chart.js infinite error loop
  if (charts.growth) { charts.growth.destroy(); delete charts.growth; }

  const labels = state.growth.map(d => d.day);
  const data   = state.growth.map(d => d.signups);

  charts.growth = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'New Signups',
        data,
        borderColor: '#00d4aa',
        backgroundColor: 'rgba(0,212,170,0.07)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      animation: false,       // disable animation — prevents render loop on resize
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#1e2d4a' }, ticks: { maxTicksLimit: 8 } },
        y: { grid: { color: '#1e2d4a' }, beginAtZero: true },
      },
    },
  });
}

// Same pattern for planChart and revenueChart — always destroy first
function renderPlanChart() {
  const canvas = document.getElementById('planChart');
  if (!canvas) return;
  if (charts.plan) { charts.plan.destroy(); delete charts.plan; }

  const a = state.analytics;
  charts.plan = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Premium', 'Free', 'Expired'],
      datasets: [{
        data: [a?.premium_users ?? 0, a?.free_users ?? 0, a?.expired_users ?? 0],
        backgroundColor: ['#f5c842', '#00d4aa', '#ff4d6d'],
        borderColor: '#0d1526',
        borderWidth: 3,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      animation: false,
      plugins: { legend: { position: 'bottom' } },
    },
  });
}
```

### 3F — Stats Rendering (from real analytics view)

```javascript
function renderStats() {
  const a = state.analytics;
  if (!a) return;

  const premium     = Number(a.premium_users);
  const total       = Number(a.total_users);
  const convRate    = total > 0 ? ((premium / total) * 100).toFixed(1) : '0.0';
  const subsMRR     = premium * 499;           // KES 499/month plan
  const adsMRR      = 12480;                   // AdSense est. KES (~$96 @ 130 KES/USD)
  const totalMRR    = subsMRR + adsMRR;

  setText('stat-total',       total.toLocaleString());
  setText('stat-premium',     premium.toLocaleString());
  setText('stat-free',        Number(a.free_users).toLocaleString());
  setText('stat-mrr',         `KES ${totalMRR.toLocaleString()}`);
  setText('stat-conv',        convRate + '%');
  setText('stat-payslips',    Number(a.total_payslips).toLocaleString());
  setText('stat-calcs',       Number(a.total_calculations).toLocaleString());
  setText('stat-week-new',    a.new_this_week);
  setText('stat-month-new',   a.new_this_month);
  setText('stat-active-week', a.active_this_week);

  // Sidebar badges
  setText('sb-total-count',   total);
  setText('sb-prem-count',    premium);

  // Revenue section
  setText('rev-subs-mrr',   `KES ${subsMRR.toLocaleString()}`);
  setText('rev-ads-est',    `KES ${adsMRR.toLocaleString()}`);
  setText('rev-total-mrr',  `KES ${totalMRR.toLocaleString()}`);
  setText('rev-arr',        `KES ${(premium * 4999).toLocaleString()}`);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '—';
}
```

### 3G — Users Table Rendering (pure, no side effects)

```javascript
// renderUsersTable reads state — it NEVER writes state
function renderUsersTable() {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;

  const users = state.filteredUsers;
  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:48px">
      <div style="font-size:32px;margin-bottom:8px">🔍</div>
      <div style="font-weight:700;color:#8fa3c8">No users found</div>
      <div style="font-size:12px;color:#4f6280;margin-top:4px">Adjust your search or filter</div>
    </td></tr>`;
    updatePagination(0);
    return;
  }

  tbody.innerHTML = users.map(u => buildUserRow(u)).join('');
  updatePagination(state.totalUsers);
}

function buildUserRow(u) {
  const isPrem    = isPremiumActive(u);
  const isExp     = isPremiumExpired(u);
  const planClass = isPrem ? 'premium' : isExp ? 'expired' : 'free';
  const planLabel = isPrem ? '⭐ PREMIUM' : isExp ? '⏰ EXPIRED' : 'FREE';
  const exp       = u.premium_expires_at ? new Date(u.premium_expires_at).toLocaleDateString('en-KE', { year:'numeric', month:'short', day:'numeric' }) : '—';
  const joined    = u.created_at ? new Date(u.created_at).toLocaleDateString('en-KE', { year:'numeric', month:'short', day:'numeric' }) : '—';
  const name      = esc(u.full_name || u.email?.split('@')[0] || 'User');
  const email     = esc(u.email || '—');
  const uid       = esc(u.id);
  const checked   = state.selectedIds.has(u.id) ? 'checked' : '';

  // Feature toggles — inline click, no re-render loop
  const p9aBadge     = featureBadge(isPrem || u.p9a_access,     uid, email, 'p9a_access');
  const payrollBadge = featureBadge(isPrem || u.payroll_access,  uid, email, 'payroll_access');

  return `<tr data-uid="${uid}">
    <td><input type="checkbox" ${checked} onchange="onRowCheck('${uid}',this)"></td>
    <td>
      <div style="font-weight:600;color:#e2eaf8">${name}</div>
      <div style="font-family:monospace;font-size:11px;color:#4f6280">${email}</div>
    </td>
    <td><span class="plan-badge ${planClass}">${planLabel}</span></td>
    <td>${p9aBadge}</td>
    <td>${payrollBadge}</td>
    <td style="font-family:monospace;font-size:12px">${exp}</td>
    <td style="font-family:monospace;font-size:12px">${joined}</td>
    <td style="font-family:monospace;font-size:12px;color:#8fa3c8">${u.calculation_count ?? '—'}</td>
    <td>
      <div style="display:flex;gap:4px">
        ${!isPrem
          ? `<button class="act-btn" title="Grant Premium" onclick="openGrantModal('${uid}','${email}')">⭐</button>`
          : `<button class="act-btn danger" title="Revoke Premium" onclick="openRevokeModal('${uid}','${email}')">🔒</button>`
        }
        <button class="act-btn" title="Reset Password" onclick="openResetModal('${uid}','${email}')">🔑</button>
        <button class="act-btn purple" title="Login as User" onclick="openImpersonateModal('${uid}','${email}','${name}')">👤</button>
        <button class="act-btn" title="Email User" onclick="emailUser('${email}')">✉️</button>
      </div>
    </td>
  </tr>`;
}

function featureBadge(isOn, uid, email, field) {
  const cls   = isOn ? 'premium' : 'free';
  const label = isOn ? '✓ ON' : '— OFF';
  const next  = !isOn;
  return `<span class="plan-badge ${cls}" style="cursor:pointer;font-size:9px"
    onclick="toggleFeature('${uid}','${email}','${field}',${next})"
    title="${next ? 'Grant' : 'Revoke'} ${field.replace('_access','')} access">${label}</span>`;
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
```

### 3H — Admin Operations (real, call Edge Function)

```javascript
// Thin wrapper — ALL admin ops go through this one function
async function callAdminFn(payload) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { showToast('Session expired — please log in again', 'error'); return {}; }

  const resp = await fetch(ADMIN_FN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,  // ← user's JWT, NOT anon key
    },
    body: JSON.stringify(payload),
  });
  return resp.json();
}

// ── GRANT PREMIUM ───────────────────────────────────────────
async function grantPremium() {
  const email    = document.getElementById('grant-email').value.trim();
  const days     = parseInt(document.getElementById('grant-days').value);
  const note     = document.getElementById('grant-note').value;
  if (!email || !days) { showToast('Email and duration required', 'error'); return; }

  setBtnLoading('grant-submit', true);
  const result = await callAdminFn({ action: 'grant_premium', email, days, note });
  setBtnLoading('grant-submit', false);

  if (result.error) { showToast('Error: ' + result.error, 'error'); return; }
  showToast(`⭐ Premium granted to ${email} for ${days} days`);
  closeModal('grant-modal');
  await loadUsers(state.page);  // refresh table — NOT full loadData()
}

// ── REVOKE PREMIUM ──────────────────────────────────────────
async function revokePremium(userId, email) {
  setBtnLoading('revoke-submit', true);
  const result = await callAdminFn({ action: 'revoke_premium', user_id: userId, email });
  setBtnLoading('revoke-submit', false);

  if (result.error) { showToast('Error: ' + result.error, 'error'); return; }
  showToast(`🔒 Premium revoked for ${email}`);
  closeModal('revoke-modal');
  await loadUsers(state.page);
}

// ── PASSWORD RESET ──────────────────────────────────────────
async function resetPassword() {
  const method  = document.getElementById('reset-method').value;
  const userId  = document.getElementById('reset-user-id').value;
  const email   = document.getElementById('reset-user-email').value;

  setBtnLoading('reset-submit', true);

  if (method === 'email') {
    const result = await callAdminFn({ action: 'reset_password_email', email });
    setBtnLoading('reset-submit', false);
    if (result.error) { showToast('Error: ' + result.error, 'error'); return; }
    showToast(`📧 Reset email sent to ${email}`);
    closeModal('reset-modal');

  } else if (method === 'link') {
    const result = await callAdminFn({ action: 'generate_reset_link', email });
    setBtnLoading('reset-submit', false);
    if (result.error) { showToast('Error: ' + result.error, 'error'); return; }
    document.getElementById('reset-link-box').style.display = 'block';
    document.getElementById('reset-link-value').value = result.link;
    showToast('🔗 Link generated — copy and send to user');

  } else if (method === 'manual') {
    const pwd  = document.getElementById('reset-new-pwd').value;
    const pwd2 = document.getElementById('reset-confirm-pwd').value;
    if (pwd.length < 8)  { showToast('Password must be ≥ 8 characters', 'error'); setBtnLoading('reset-submit', false); return; }
    if (pwd !== pwd2)    { showToast('Passwords do not match', 'error'); setBtnLoading('reset-submit', false); return; }
    const result = await callAdminFn({ action: 'set_password', user_id: userId, email, password: pwd });
    setBtnLoading('reset-submit', false);
    if (result.error) { showToast('Error: ' + result.error, 'error'); return; }
    showToast(`✅ Password set for ${email}`);
    closeModal('reset-modal');
  }
}

// ── IMPERSONATE / LOGIN AS USER ─────────────────────────────
async function generateMagicLink() {
  const email = document.getElementById('imp-email').value;
  setBtnLoading('imp-btn', true, 'Generating...');

  const result = await callAdminFn({ action: 'generate_magic_link', email });
  setBtnLoading('imp-btn', false);

  if (result.error) { showToast('Error: ' + result.error, 'error'); return; }

  const link = result.link;
  document.getElementById('imp-link-box').style.display  = 'block';
  document.getElementById('imp-link-value').value        = link;

  const openBtn = document.getElementById('imp-open-btn');
  openBtn.style.display = 'inline-flex';
  openBtn.onclick = () => {
    window.open(link, '_blank');
    showToast(`👤 Opened ${email} in new tab`);
    closeModal('impersonate-modal');
    showImpersonationBanner(email);
  };
  showToast(`✅ Magic link ready — expires in ~60 seconds`);
}

function showImpersonationBanner(email) {
  document.getElementById('imp-banner-email').textContent = email;
  document.getElementById('impersonation-banner').style.display = 'flex';
}

// ── FEATURE TOGGLE ──────────────────────────────────────────
async function toggleFeature(userId, email, field, newValue) {
  const result = await callAdminFn({ action: 'toggle_feature', user_id: userId, email, field, value: newValue });
  if (result.error) { showToast('Error: ' + result.error, 'error'); return; }
  const label = field === 'p9a_access' ? 'P9A Generator' : 'Payroll Import';
  showToast(`${newValue ? '✅' : '🔒'} ${label} ${newValue ? 'granted' : 'revoked'} for ${email}`);
  // Update local state without re-fetching
  const u = state.users.find(u => u.id === userId);
  if (u) u[field] = newValue;
  applyFilter(); // re-renders table only — no Supabase call
}
```

### 3I — Auth Flow (login form, no page reload loop)

```javascript
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pwd   = document.getElementById('login-pwd').value;
  const errEl = document.getElementById('login-err');
  errEl.style.display = 'none';

  if (!email || !pwd) {
    errEl.textContent = 'Please fill in both fields.';
    errEl.style.display = 'block';
    return;
  }

  setBtnLoading('login-btn', true, 'Signing in...');
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pwd });
  setBtnLoading('login-btn', false, 'Access Command Center →');

  if (error) {
    errEl.textContent = error.message;
    errEl.style.display = 'block';
    return;
  }

  // Auth state listener handles the rest — but to avoid double-boot:
  state.adminUser = data.user;
  hideLoginForm();
  await boot();
}

async function doLogout() {
  await sb.auth.signOut();
  // onAuthStateChange SIGNED_OUT → window.location.reload()
}
```

### 3J — Utility Functions

```javascript
function setBtnLoading(id, isLoading, loadingText = '⏳ Loading...') {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled   = isLoading;
  if (isLoading) {
    btn._origText  = btn.textContent;
    btn.textContent = loadingText;
  } else {
    btn.textContent = btn._origText || btn.textContent;
  }
}

let toastTimer;
function showToast(msg, type = 'success') {
  const t   = document.getElementById('toast');
  const ico = document.getElementById('toast-icon');
  const txt = document.getElementById('toast-msg');
  if (!t) return;
  ico.textContent = type === 'error' ? '⚠️' : '✅';
  txt.textContent = msg;
  t.className     = `toast show${type === 'error' ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3800);
}

function openModal(id)  { document.getElementById(id)?.classList.add('show');    }
function closeModal(id) { document.getElementById(id)?.classList.remove('show'); }

// Close modal on backdrop click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('show');
  }
});

// ESC closes any open modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'));
  }
});

function startClock() {
  const el = document.getElementById('topbar-time');
  if (!el) return;
  const tick = () => {
    el.textContent = new Date().toLocaleTimeString('en-KE', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };
  tick();
  setInterval(tick, 1000); // OK — only updates DOM text, no Supabase calls
}

function updatePagination(total) {
  const info  = document.getElementById('page-info');
  const btns  = document.getElementById('page-btns');
  const pages = Math.ceil(total / state.pageSize);
  if (info) info.textContent = `${state.filteredUsers.length} of ${total} users`;
  if (!btns) return;
  btns.innerHTML = '';
  for (let i = 1; i <= Math.min(pages, 8); i++) {
    const b = document.createElement('button');
    b.className   = 'page-btn' + (i === state.page ? ' active' : '');
    b.textContent = i;
    b.onclick     = () => loadUsers(i);  // loads fresh from Supabase, replaces state.users
    btns.appendChild(b);
  }
}

// Search input: debounce 300ms, then applyFilter (no Supabase call for search)
let searchTimer;
function onSearchInput(val) {
  state.searchQuery = val;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => applyFilter(), 300);
}

function onFilterChange(filter) {
  state.filter = filter;
  state.page   = 1;
  applyFilter();
}

function exportCSV() {
  const rows = [['Name','Email','Plan','Expires','Joined','Calculations']];
  state.users.forEach(u => {
    rows.push([
      u.full_name || '',
      u.email || '',
      isPremiumActive(u) ? 'premium' : isPremiumExpired(u) ? 'expired' : 'free',
      u.premium_expires_at || '',
      u.created_at || '',
      u.calculation_count || 0,
    ]);
  });
  const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a    = Object.assign(document.createElement('a'), {
    href:     URL.createObjectURL(blob),
    download: `sc-users-${new Date().toISOString().slice(0,10)}.csv`,
  });
  a.click();
  showToast('📥 CSV exported');
}

// Single boot call — the last line in the script
init();
```

---

## PART 4 — HTML SECTIONS TO BUILD

Write these sections in the HTML. The design matches the existing dark terminal aesthetic
(same CSS variables, same font stack). Do not use a CSS framework.

### Required `<head>` imports:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=JetBrains+Mono:wght@400;500;700&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet">
```

### Required DOM IDs (the JS above references these — include all):

**Stats cards:** `stat-total`, `stat-premium`, `stat-free`, `stat-mrr`, `stat-conv`, `stat-payslips`, `stat-calcs`, `stat-week-new`, `stat-month-new`, `stat-active-week`

**Charts:** `growthChart` (canvas), `planChart` (canvas), `revenueChart` (canvas)

**Users table:** `users-tbody`, `user-search` (input), `page-info`, `page-btns`, `select-all` (checkbox)

**Sidebar:** `sb-total-count`, `sb-prem-count`, `admin-name`, `admin-initial`

**Topbar:** `topbar-title`, `topbar-time`

**Grant modal:** `grant-modal`, `grant-email`, `grant-days`, `grant-note`, `grant-submit`

**Revoke modal:** `revoke-modal`, `revoke-user-id` (hidden input), `revoke-user-email` (display), `revoke-submit`

**Reset modal:** `reset-modal`, `reset-user-id` (hidden), `reset-user-email` (hidden), `reset-method` (select), `reset-link-box` (hidden div), `reset-link-value`, `reset-new-pwd`, `reset-confirm-pwd`, `reset-submit`

**Impersonate modal:** `impersonate-modal`, `imp-email` (hidden), `imp-name` (display), `imp-link-box`, `imp-link-value`, `imp-btn`, `imp-open-btn`

**Impersonation banner:** `impersonation-banner` (fixed bar, hidden by default), `imp-banner-email`

**Auth overlay:** `login-email`, `login-pwd`, `login-btn`, `login-err`

**Toast:** `toast`, `toast-icon`, `toast-msg`

**Revenue:** `rev-subs-mrr`, `rev-ads-est`, `rev-total-mrr`, `rev-arr`

---

## PART 5 — IMPERSONATION BANNER ON MAIN SITE

Add this snippet immediately after `<body>` on `calculator.html`, `payslip-generator-kenya.html`,
`account.html`, `employees.html` — every page a user would land on after following the magic link.

```html
<script>
(function() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('sc_admin') === '1') {
    sessionStorage.setItem('sc_admin_active', '1');
    // Clean the ?sc_admin=1 param from URL without reload
    history.replaceState({}, '', window.location.pathname);
  }
  if (!sessionStorage.getItem('sc_admin_active')) return;

  // Wait for Supabase user to load (set window.__SC_EMAIL in your auth listener)
  const render = () => {
    const email = window.__SC_EMAIL || 'user';
    const bar   = document.createElement('div');
    bar.id      = 'sc-admin-bar';
    bar.style.cssText = [
      'position:fixed;top:0;left:0;right:0;z-index:99999',
      'background:linear-gradient(135deg,#7c3aed,#a855f7)',
      'color:#fff;padding:10px 20px;display:flex;align-items:center;gap:12px',
      'font-family:sans-serif;font-size:13px;font-weight:600',
      'box-shadow:0 4px 20px rgba(124,58,237,0.5)',
    ].join(';');
    bar.innerHTML = [
      '<span>🛡</span>',
      '<span style="background:rgba(255,255,255,.2);border-radius:20px;padding:2px 12px;font-size:11px;font-family:monospace;letter-spacing:1px">ADMIN SESSION</span>',
      `<span>Viewing as <strong>${email}</strong></span>`,
      '<a href="/admin.html" style="margin-left:auto;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.4);color:#fff;border-radius:6px;padding:5px 14px;font-weight:700;text-decoration:none;font-size:12px;white-space:nowrap">← Return to Admin</a>',
    ].join('');
    document.body.prepend(bar);
    document.body.style.paddingTop =
      (parseFloat(getComputedStyle(document.body).paddingTop) || 0) + 48 + 'px';
  };

  // If user email already set, render immediately; otherwise wait 800ms
  if (window.__SC_EMAIL) render();
  else setTimeout(render, 800);
})();
</script>
```

In your auth listener on those pages, set `window.__SC_EMAIL`:

```javascript
sb.auth.onAuthStateChange((_event, session) => {
  if (session?.user) window.__SC_EMAIL = session.user.email;
});
```

---

## PART 6 — DEPLOYMENT CHECKLIST

Run these in order before pushing to production:

```bash
# 1. Deploy Edge Function
supabase functions deploy admin-ops --project-ref wznopthjoaqusalqoyru

# 2. Set secrets (Supabase Dashboard → Edge Functions → admin-ops → Secrets)
#    SUPABASE_SERVICE_ROLE_KEY = <your service role key>
#    ADMIN_EMAILS              = kesalarycalculator@gmail.com

# 3. Run the SQL from Part 1 in Supabase SQL Editor

# 4. Replace ANON_KEY in admin.html with your actual anon public key
#    (Supabase → Settings → API → anon public)

# 5. Verify vercel.json has the merged headers (no duplicate keys)

# 6. Push to GitHub → Vercel auto-deploys

# 7. Test sequence:
#    a. Open admin.html → login → dashboard loads real data
#    b. Watch Network tab — confirm NO repeated /admin-ops calls
#    c. Grant premium to a test user → check user_profiles in Supabase
#    d. Reset password via email → check test inbox
#    e. Generate magic link → open in new tab → confirm purple banner shows
#    f. Refresh button → single data load, no loop
```

---

## PART 7 — COMMON MISTAKES TO AVOID

```
❌ DO NOT use `onAuthStateChange` to trigger data loading
   → use `getSession()` once at init

❌ DO NOT call new Chart() without destroying the previous instance
   → always: if (charts.x) { charts.x.destroy(); }

❌ DO NOT put loadData() inside renderUsersTable()
   → render functions are pure: they read state, never fetch

❌ DO NOT use the ANON KEY as the Authorization header for admin-ops
   → use session.access_token (the user's JWT)
   → the Edge Function verifies this JWT to confirm it's really an admin

❌ DO NOT use the SERVICE ROLE KEY in client-side code
   → it lives only in Supabase Edge Function secrets

❌ DO NOT call applyFilter() inside renderUsersTable()
   → applyFilter() → renderUsersTable() is one-directional

❌ DO NOT use setInterval to poll Supabase
   → use a Refresh button

❌ DO NOT create global event listeners inside functions that can be called multiple times
   → create them once at DOM ready, not inside init()
```

---

*salarycalculator.co.ke · Moses W. Mwombe (Monar) · Afams Ltd / MonarCat*
*Supabase: wznopthjoaqusalqoyru · Vercel · Cloudflare · Paystack · Zoho SMTP*
