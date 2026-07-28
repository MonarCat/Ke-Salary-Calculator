# Production Security, Architecture & Code-Quality Audit

Audit date: 2026-07-24. This is a static repository audit; deployed Supabase RLS,
grants, Auth settings, Storage policies, secrets, and Vercel configuration still
require live verification.

## Phase 1 — Architecture summary

Vercel serves a static multi-page app. Browser scripts load Supabase JS from a CDN,
use an anon key, and call Auth/PostgREST directly. Vercel routes use service-role
credentials for payments, password reset, admin operations and mail. Edge Functions
duplicate some of these capabilities. SQL is split between `supabase/migrations/`
and `database/`, so clean deployments are not reproducible. The browser also caches
employer and employee PII in localStorage.

## Phase 2 — Security findings

### 1. Critical — users can update privileged fields on their own profile

**File:** `supabase/migrations/001_initial_schema.sql:64-68`,
`supabase/migrations/015_fix_premium_activation.sql:41-45`.

**Explanation / impact:** Owner UPDATE policies cover the complete `user_profiles`
row, which contains `premium`, expiry, payroll/P9A access, `is_admin`, and
`is_banned` (`001_initial_schema.sql:18-35`). RLS is row-level, not column-level.
An authenticated user can call PostgREST directly and grant premium or change
authorization flags, bypassing client gates.

**Exact change:** revoke direct UPDATE and expose only a narrow self-service RPC.

```sql
DROP POLICY IF EXISTS "users_own_profile_update" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
REVOKE UPDATE ON public.user_profiles FROM anon, authenticated;
CREATE OR REPLACE FUNCTION public.update_my_profile(p_full_name text, p_newsletter boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.user_profiles SET full_name = left(trim(p_full_name), 120),
    newsletter_subscribed = p_newsletter WHERE id = auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.update_my_profile(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_profile(text, boolean) TO authenticated;
```

### 2. Critical — privileged `SECURITY DEFINER` functions retain PUBLIC execute

**File:** `supabase/migrations/004_premium_and_newsletter.sql:53-83`.

**Explanation / impact:** `grant_premium` is definer-rights, accepts arbitrary
email, has no fixed search path, and execution is never revoked. PostgreSQL grants
execute on new functions to PUBLIC by default. If exposed as RPC, it becomes direct
premium escalation; unsafe definer name resolution is an additional escalation risk.

**Exact change:** remove it if not needed; otherwise restrict it to service role
and fix the search path. Apply this to every definer function including
`activate_trial_by_email` and `get_user_id_by_email`.

```sql
CREATE OR REPLACE FUNCTION public.grant_premium(p_email text, p_source text DEFAULT 'admin', p_months int DEFAULT 1)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF p_months NOT BETWEEN 1 AND 24 THEN RAISE EXCEPTION 'invalid duration'; END IF;
  UPDATE public.user_profiles SET premium = true,
    premium_expires_at = now() + make_interval(months => p_months), premium_source = p_source
  WHERE id = (SELECT id FROM auth.users WHERE lower(email) = lower(p_email));
END $$;
REVOKE ALL ON FUNCTION public.grant_premium(text, text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_premium(text, text, int) TO service_role;
```

### 3. High — public Paystack verification can replay a successful reference

**File:** `api/paystack-verify.js:45-50,113-149`.

**Explanation / impact:** Any caller may supply a reference. Once verified, the
endpoint recalculates expiry and upserts premium even when the reference already
exists. There is no caller identity or purchase-intent binding, enabling a leaked
valid reference to extend access repeatedly.

**Exact change:** create an authenticated server-side payment intent with expected
user/amount/currency/plan, and atomically consume it before changing premium.

```js
const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
const { data: { user }, error } = await caller.auth.getUser(token);
if (error || !user) return res.status(401).json({ error: 'Unauthenticated' });
const { data: intent } = await supabase.from('payment_intents')
  .select('user_id, amount_kobo, currency, consumed_at').eq('reference', reference)
  .eq('user_id', user.id).is('consumed_at', null).single();
if (!intent || txData.amount !== intent.amount_kobo || txData.currency !== intent.currency)
  return res.status(403).json({ error: 'Invalid payment intent' });
const { data: claimed } = await supabase.rpc('claim_verified_payment', { p_reference: reference });
if (!claimed) return res.status(409).json({ error: 'Reference already processed' });
```

### 4. High — stored DOM XSS through user metadata

**File:** `assets/js/auth.js:547-582`; input source `auth.js:238-295`.

**Explanation / impact:** Full name and email are interpolated into
`authLinks.innerHTML`; OAuth metadata is also untrusted. A stored payload runs on
pages that render navigation and can read Supabase browser sessions and payroll PII.

**Exact change:** construct user-derived DOM with `textContent`; reserve
`innerHTML` for static markup only.

```js
const name = String(user.user_metadata?.full_name || user.email.split('@')[0]);
const welcome = document.createElement('span');
welcome.className = 'user-welcome-text';
welcome.textContent = `Welcome, ${name}`;
// Append static controls and `welcome`; do not interpolate name/email into innerHTML.
```

### 5. High — payroll PII persists in browser storage

**File:** `employees.html:1160-1173,1243-1246`.

**Explanation / impact:** KRA PIN, bank account, salary, next-of-kin, employer
identifiers and contacts are written to predictable localStorage keys. XSS,
extensions, shared-device profiles and browser backups can disclose this data.

**Exact change:** remove the local fallback after server migration. Keep only
non-sensitive preferences in browser storage; specify and encrypt any true offline
mode.

```js
if (!error && data) {
  employees = data.map(_fromRow);
  localStorage.removeItem(`employees_${user.id}`);
  localStorage.removeItem(`employerProfile_${user.id}`);
  renderEmployees();
}
```

### 6. High — schema/RLS deployment drift

**File:** `database/009_employees_extended.sql`, `database/employers-setup.sql`,
and `supabase/migrations/`.

**Explanation / impact:** employer/employee/storage definitions live outside the
ordered migration chain. The frontend also calls payroll, P9A, budget and history
relations not defined by that chain. A clean deployment can miss a table, policy,
index or constraint; manually applied SQL is not reproducible.

**Exact change:** make `supabase/migrations/` the sole source of truth. Convert
all needed `database/*.sql` definitions into monotonic migrations, delete/deprecate
manual copies, and add CI: `supabase db reset && supabase db lint` plus
cross-tenant RLS smoke tests for every relation used by browser code.

### 7. High — anyone can modify newsletter records

**File:** `database/newsletter-subscribers-setup.sql:19-22`.

**Explanation / impact:** public UPDATE has `USING (true) WITH CHECK (true)`, so
any visitor can change another email’s subscription/source.

**Exact change:** remove public UPDATE/upsert. Perform confirmation and
unsubscribe through a rate-limited endpoint with a single-use signed token.

```sql
DROP POLICY IF EXISTS "Anyone can upsert their own subscription" ON public.newsletter_subscribers;
CREATE POLICY "anon_can_request_subscription" ON public.newsletter_subscribers
  FOR INSERT TO anon, authenticated
  WITH CHECK (char_length(email) <= 254 AND email ~* '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$');
```

### 8. Medium — password reset lacks abuse controls

**File:** `api/request-password-reset.js:150-203`.

**Explanation / impact:** public requests produce a recovery link/mail with no
per-IP or per-email limit, CAPTCHA assertion or queue. Attackers can flood users,
damage sending reputation and create mail cost.

**Exact change:** apply Vercel/WAF and persistent rate limits keyed by hashed
email/IP, require verified Turnstile, and always respond with the same 200 body.

```js
const key = sha256(`${req.headers['x-forwarded-for'] ?? ''}:${email}`);
if (!(await consumeRateLimit(key, 3, '15m'))) return res.status(200).json(GENERIC_SUCCESS);
if (!(await verifyTurnstile(req.body?.turnstileToken, req))) return res.status(200).json(GENERIC_SUCCESS);
```

### 9. Medium — webhook hardening is incomplete

**File:** `api/paystack-webhook.js:76-82,96-101`.

**Explanation / impact:** HMAC uses `===` and raw request content is buffered
without a stated size cap, creating avoidable timing and memory-exhaustion risk.

**Exact change:** use constant-time buffers after length validation and reject
bodies above 1 MB while reading.

```js
const expected = Buffer.from(hash, 'hex');
const provided = Buffer.from(signature, 'hex');
return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
```

### 10. Medium — security headers do not contain script injection

**File:** `vercel.json:31-37`; inline handlers in `assets/js/auth.js:552-578`.

**Explanation / impact:** there is no CSP, HSTS or Permissions-Policy. Inline
scripts/handlers prevent a strict CSP, so successful XSS can execute and read
browser-held credentials.

**Exact change:** externalize handlers/scripts, deploy a nonce/hash CSP (start
report-only), then add HSTS and Permissions-Policy.

```json
{ "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net 'nonce-{NONCE}'; connect-src 'self' https://wznopthjoaqusalqoyru.supabase.co https://api.paystack.co; img-src 'self' data: https:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'" }
```

### 11. Medium — anonymous users can query admin analytics views

**File:** `supabase/migrations/018_admin_analytics_repair.sql:38-39`.

**Explanation / impact:** both admin views are granted to `anon` and
`authenticated`, exposing business metrics without admin authorization.

**Exact change:** revoke public grants and return analytics only after server-side
admin authorization.

```sql
REVOKE ALL ON public.admin_analytics, public.admin_growth_daily FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.admin_analytics, public.admin_growth_daily TO service_role;
```

### 12. Medium — email personalization injects profile values as HTML

**File:** `api/send-email.js:45-59,222-227`.

**Explanation / impact:** `{{name}}` and `{{email}}` values are unescaped within
HTML sent to other users, so hostile profile data can inject markup/tracking.

**Exact change:** HTML-escape all replacements and use vetted templates.

```js
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
return template.replace(/\{\{name\}\}/g, escapeHtml(getName(user)))
  .replace(/\{\{email\}\}/g, escapeHtml(user.email || ''));
```

## Phase 3 — Admin panel review

The committed `admin.html` and `assets/js/admin.js` provide user and organisation
lists/counts only. `loadDashboardStats()` calls `get_blog_stats`
(`admin.js:111-130`), not payroll KPIs. There is no UI for employee count,
payroll runs, gross/net/PAYE/SHIF/NSSF/housing-levy totals, role changes, company
assignment, suspension/delete, reports, or CSV/Excel/PDF exports.

`admin_audit_log` records some server admin actions but not login, employee edits,
payroll creation/approval, or payslip generation. Its write failure is non-fatal
(`api/admin-ops.js:217-232`). Build append-only organisation-scoped audit events
with actor UUID, organisation UUID, entity type/ID, request ID, before/after JSONB,
timestamp and selected network metadata. Write events in the same transaction as
the business action. Use one database role source for admin authorization and
remove the UI-only email fallback at `assets/js/admin.js:17-26`.

## Phase 4 — Code quality

- Duplicate admin/password-reset implementations exist in `index.ts`, Vercel API
  routes and Edge Functions. Select one runtime and delete the others.
- `assets/js/script.js` is 1,248 lines and critical logic is embedded in HTML.
  Extract typed modules for repositories, validation, statutory rules, rendering
  and feature gates.
- Silent catches at `employees.html:1187-1189,1275-1277` hide security/data
  failures. Display safe errors and log structured correlation IDs.
- There are no test scripts in `package.json`. Pin dependencies and add unit,
  Supabase RLS integration, and browser tests.

## Phase 5 — Database review

Employee owner RLS and `(employer_id, employee_id)` uniqueness in
`database/009_employees_extended.sql:7-19,40-46` are a good baseline. However,
bank/KRA/next-of-kin data is in a broad row with no retention, access audit, or
field separation. Introduce `organisations`, `organisation_members` and roles;
use `organisation_id` everywhere instead of treating a single auth user as a
company. Add immutable `payroll_runs`, `payroll_run_items` and
`payslip_documents` with calculation/rate version, approval state and idempotency
keys. Add CHECKs for money/status/currency/PII formats, explicit `WITH CHECK` on
all write policies, tenant/date indexes and retention rather than cascaded
historical payroll deletion. Replace browser `select('*')`, for example
`employees.html:1255-1258`, with minimal projections.

## Phase 6 — Performance improvements

1. Paginate employees, histories, audits and admin users with tenant/date indexes.
2. Replace all browser/admin `select('*')` calls with needed columns.
3. Split page monoliths into cacheable hashed modules.
4. Lazy-load PDF/XLSX/CSV libraries only after an export action.
5. Store/report payroll aggregates in SQL instead of browser loops.
6. Debounce search and use cursor/range pagination in `admin-ops`.
7. Queue bulk email: `api/send-email.js:219-239` sends serially.
8. Serve responsive compressed WebP/AVIF images with dimensions.
9. Cache only fingerprinted public assets; authenticated/API responses stay no-store.
10. Add RUM, query timings, error tracing and Lighthouse budgets.

## Phase 7 — Production readiness

| Area | Rating | Basis |
|---|---|---|
| Authentication | 🟡 Needs Improvement | Supabase Auth and redirect allow-list exist; reset abuse remains. |
| Authorization | 🔴 Critical | Broad profile UPDATE and risky definer functions. |
| Supabase Security | 🔴 Critical | Migration drift prevents reproducible RLS/grants. |
| Database Design | 🟡 Needs Improvement | Employee baseline exists; immutable tenant payroll is absent. |
| Frontend Security | 🔴 Critical | Stored DOM XSS and local PII cache. |
| Performance | 🟡 Needs Improvement | Static delivery is good; unpaginated/eager work remains. |
| Maintainability | 🔴 Critical | Duplicate backends/schema sources and no test baseline. |
| Scalability | 🟡 Needs Improvement | Bulk email/browser aggregation will not scale. |
| Admin Panel | 🔴 Critical | Required KPIs, controls, reports and audit coverage absent. |

## Top 10 lists

### Security

1. Narrow `user_profiles` writes.
2. Revoke public definer-function execution.
3. Bind and atomically consume payment intents.
4. Remove metadata-to-HTML sinks.
5. Remove payroll PII from browser storage.
6. Consolidate and test RLS migrations.
7. Remove public newsletter UPDATE.
8. Rate-limit/CAPTCHA password reset.
9. Add CSP and external event handlers.
10. Restrict analytics to server-authorized admins.

### Architecture

1. One migration chain.
2. One server runtime.
3. Organisation membership and roles.
4. Immutable payroll run model.
5. Versioned tax-rule module.
6. Server-only privilege changes.
7. Typed repositories and DTO validation.
8. Append-only audit events.
9. PII, billing and public schema separation.
10. Migration, RLS and browser CI.

### Production readiness

1. Fix findings 1–4 before production payroll/payment.
2. Rotate/review secrets.
3. Rebuild a clean DB and run tenant-isolation tests.
4. Configure email confirmation, admin MFA, password policy, CAPTCHA and sessions.
5. Configure WAF/rate limits/security headers.
6. Test backups/restores.
7. Complete admin/report/audit work.
8. Monitor payment, RLS, error and mail signals.
9. Define PII consent, retention and incident procedures.
10. Pin and SCA-scan dependencies.

## Scores

| Category | Score / 100 |
|---|---:|
| Security | 28 |
| Architecture | 38 |
| Performance | 52 |
| Maintainability | 30 |
| Code Quality | 42 |
| Production Readiness | 24 |

**Release decision: do not process production payroll or payments until the two
critical authorization findings, Paystack replay and stored DOM XSS are fixed and
verified against the deployed Supabase project.**

## Verification limitations

`npm ls --omit=dev` reports both declared dependencies absent in this checkout.
`npm audit --omit=dev` could not reach npm (`EAI_AGAIN`), so no dependency
vulnerability conclusion is made. No live credentials were used; deployed RLS,
grants, Auth, Storage and secret handling require the live checks above.
