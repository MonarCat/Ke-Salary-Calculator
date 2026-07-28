# 🤖 GitHub Copilot Prompt — SC Admin Dashboard Integration
## salarycalculator.co.ke · Supabase Project: wznopthjoaqusalqoyru

---

## CONTEXT

You are implementing the backend wiring for the **Salary Calculator Kenya admin dashboard** (`admin.html`). The frontend is a complete static HTML/CSS/JS file. Your job is to:

1. Deploy the `admin-ops` Supabase Edge Function
2. Add the required columns to `user_profiles` in Supabase
3. Plug the real `SUPABASE_ANON_KEY` into `admin.html`
4. Set Edge Function secrets in Supabase dashboard
5. Wire up the impersonation banner on `calculator.html` (and all auth-gated pages)

**Stack:** Static HTML/CSS/JS on Vercel · Supabase (Deno Edge Functions) · Paystack · Zoho SMTP · Cloudflare DNS

---

## STEP 1 — Supabase: Add missing columns to user_profiles

Run this SQL in **Supabase → SQL Editor**:

```sql
-- Add feature access columns (if not already present)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS p9a_access       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS payroll_access   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_note       TEXT,
  ADD COLUMN IF NOT EXISTS calculation_count INT DEFAULT 0;

-- Add CHECK constraint so premium_source can include 'admin'
-- (run only if constraint already exists and doesn't include 'admin')
ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_premium_source_check;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_premium_source_check
  CHECK (premium_source IN ('paystack', 'admin', 'easter_gift_2026', 'manual', NULL));

-- Index on email for fast lookup
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles (email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_premium ON user_profiles (premium_expires_at);
```

---

## STEP 2 — Deploy admin-ops Edge Function

The function file is at: `supabase/functions/admin-ops/index.ts`

```bash
# From your project root
supabase functions deploy admin-ops --project-ref wznopthjoaqusalqoyru
```

### Set secrets in Supabase Dashboard → Edge Functions → admin-ops → Secrets:

| Secret name              | Value                                                              |
|--------------------------|--------------------------------------------------------------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key from Supabase → Settings → API             |
| `ADMIN_EMAILS`           | `kesalarycalculator@gmail.com` (comma-separated for multiple admins) |
| `ADMIN_SECRET`           | Any long random string (e.g. generate with `openssl rand -hex 32`) |

The function URL will be:
```
https://wznopthjoaqusalqoyru.supabase.co/functions/v1/admin-ops
```

---

## STEP 3 — Plug SUPABASE_ANON_KEY into admin.html

In `admin.html`, find this section near the top of the `<script>` block:

```javascript
const SUPABASE_URL = 'https://wznopthjoaqusalqoyru.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE'; // ← REPLACE THIS
```

Replace `YOUR_ANON_KEY_HERE` with your **anon/public key** from:
**Supabase → Settings → API → Project API keys → anon public**

> ⚠️ The anon key is safe to include in client-side code. The service role key must NEVER go in the frontend — it stays only in the Edge Function secrets.

---

## STEP 4 — Protect admin.html via Vercel middleware

Create `middleware.ts` in your project root (if not already there):

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  // Protect /admin.html — redirect unauthenticated users
  // The actual auth check happens inside admin.html via Supabase JS
  // This just prevents direct indexing/crawling
  if (req.nextUrl.pathname === '/admin.html') {
    const ua = req.headers.get('user-agent') || '';
    if (ua.includes('Googlebot') || ua.includes('bot')) {
      return new Response('Forbidden', { status: 403 });
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin.html'] };
```

Also add to `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/admin.html",
      "headers": [
        { "key": "X-Robots-Tag", "value": "noindex, nofollow" },
        { "key": "Cache-Control", "value": "no-store" }
      ]
    }
  ]
}
```

---

## STEP 5 — Impersonation Banner on the main site

The admin "Login as User" feature generates a Supabase magic link. When the admin opens that link, Supabase logs them in as the target user. To show an **admin session banner** on the main site, add this snippet to the top of `calculator.html`, `payslip-generator-kenya.html`, and any other auth-gated pages:

```html
<!-- ADMIN IMPERSONATION BANNER — add just after <body> on auth-gated pages -->
<script>
(function() {
  // Detect if this session was initiated via admin magic link
  const params = new URLSearchParams(window.location.search);
  const isAdminSession = params.get('admin_session') === '1';

  if (isAdminSession || sessionStorage.getItem('sc_admin_session')) {
    sessionStorage.setItem('sc_admin_session', '1');

    // Get the current user's email to display in the banner
    // (assumes supabase client is already initialised on the page)
    window.addEventListener('DOMContentLoaded', async () => {
      const userEmail = window.__SC_USER_EMAIL || 'user';
      const bar = document.createElement('div');
      bar.style.cssText = `
        position:fixed;top:0;left:0;right:0;z-index:9999;
        background:linear-gradient(135deg,#7c3aed,#a855f7);
        color:#fff;padding:10px 20px;
        display:flex;align-items:center;gap:12px;
        font-family:sans-serif;font-size:13px;font-weight:600;
        box-shadow:0 4px 20px rgba(124,58,237,0.5);
      `;
      bar.innerHTML = `
        <span>🛡</span>
        <span style="background:rgba(255,255,255,0.2);border-radius:20px;padding:2px 12px;font-size:11px;font-family:monospace;letter-spacing:1px;font-weight:700">ADMIN SESSION</span>
        <span>Viewing as <strong>${userEmail}</strong> · Admin support mode active</span>
        <a href="/admin.html" style="margin-left:auto;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.4);color:#fff;border-radius:6px;padding:5px 14px;font-weight:700;text-decoration:none;font-size:12px">
          ← Return to Admin
        </a>
      `;
      document.body.prepend(bar);
      document.body.style.paddingTop = (parseInt(getComputedStyle(document.body).paddingTop)||0) + 44 + 'px';

      // Clean URL
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    });
  }
})();
</script>
```

Set `window.__SC_USER_EMAIL` on those pages when the Supabase session loads:

```javascript
// In your existing auth listener (wherever you call supabase.auth.getUser)
sb.auth.onAuthStateChange(async (event, session) => {
  if (session?.user) {
    window.__SC_USER_EMAIL = session.user.email;
  }
});
```

---

## STEP 6 — user_profiles RLS Policy for admin-ops

Ensure the Edge Function (running as service role) can read/write `user_profiles`. The service role bypasses RLS by default — no policy change needed. But if you want the admin dashboard's anon client to read profiles for its own session:

```sql
-- Allow authenticated users to read their own profile
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Allow authenticated users to update own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- The admin-ops edge function uses service role — bypasses RLS entirely.
-- No admin-specific policy needed.
```

---

## STEP 7 — Test the admin features

After deployment, verify in this order:

```
1. Open https://salarycalculator.co.ke/admin.html
2. Sign in with kesalarycalculator@gmail.com (or whichever ADMIN_EMAILS you set)
3. Dashboard should load live user data from user_profiles
4. Test: Grant Premium → find a test user → grant 30 days
5. Test: Reset Password → select "Send reset email" → check inbox
6. Test: Login as User → generate magic link → open in new tab → confirm banner appears
7. Test: Toggle P9A/Payroll Import access → verify column update in Supabase dashboard
8. Test: Email Center → send a test email to yourself
```

---

## WHAT EACH ADMIN BUTTON DOES (summary for Copilot)

| Button | Action | Edge Function call |
|--------|--------|--------------------|
| ⭐ (Grant) | Opens Grant Premium modal | `admin-ops` → `grant_premium` |
| 🔒 (Revoke) | Opens Revoke modal | `admin-ops` → `revoke_premium` |
| 🔑 (Reset PWD) | Opens Password Reset modal with 3 methods | `admin-ops` → `reset_password_email` / `generate_reset_link` / `set_password` |
| 👤 (Login As) | Opens Impersonate modal → generates magic link | `admin-ops` → `generate_magic_link` |
| ✉️ (Email) | Pre-fills Email Center for that user | Local state only |
| P9A ✓/— toggle | Grants/revokes P9A Generator access | Direct `user_profiles` update via `toggle_feature` |
| Payroll ✓/— toggle | Grants/revokes Payroll Import access | Direct `user_profiles` update via `toggle_feature` |

---

## PASSWORD RESET — 3 methods

The admin can choose between:

1. **Send reset email** — Calls `supabase.auth.admin.generateLink({ type: 'recovery', email })`. Supabase automatically emails the user their reset link. User clicks it → lands on `/reset-password`.

2. **Generate link** — Same API call but admin copies the link and sends it manually (useful if the user's email is bouncing). Returns `data.properties.action_link`.

3. **Set password directly** — Calls `supabase.auth.admin.updateUserById(user_id, { password })`. Immediate — no email needed. Use for users who are on the phone with you.

---

## IMPERSONATION — How the magic link works

```
Admin clicks "Login as User"
       ↓
admin-ops Edge Function called with action: "generate_magic_link"
       ↓
Supabase: generateLink({ type: "magiclink", email: userEmail })
       ↓
Returns action_link (one-time OTP URL, expires in ~60 seconds)
       ↓
Admin opens link in new tab
       ↓
Supabase authenticates as the user → session created
       ↓
calculator.html detects ?admin_session=1 → shows purple banner
       ↓
Admin can now generate payslips, check settings, troubleshoot
       ↓
Admin clicks "← Return to Admin" → back to admin.html
```

> The admin's own session in the original tab is completely unaffected.
> The impersonated session is isolated to the new tab.
> The magic link is single-use and expires in ~60 seconds.

---

## FILES REFERENCE

| File | Purpose |
|------|---------|
| `admin.html` | Admin dashboard (deploy to Vercel as static file) |
| `supabase/functions/admin-ops/index.ts` | Edge Function (deploy via Supabase CLI) |
| `vercel.json` | Add noindex header for admin.html |
| `middleware.ts` | Block bots from admin.html |

---

*Generated for salarycalculator.co.ke · Monar (Moses W. Mwombe) · Afams Ltd / MonarCat*
*Stack: Static HTML+Supabase+Paystack+Zoho+Cloudflare+Vercel*
