# COPILOT PROMPT — Replace hCaptcha with Cloudflare Turnstile
**Project:** salarycalculator.co.ke  
**Stack:** Static HTML/CSS/JS · Supabase (project: `wznopthjoaqusalqoyru`) · Vercel  
**Scope:** Login page · Register/Sign-up page · New Supabase Edge Function  

---

## CONTEXT

hCaptcha has been removed from the account. Cloudflare Turnstile replaces it on the Login and Register pages. Turnstile is already available via our Cloudflare account (same account managing DNS for this domain).

Turnstile is non-intrusive — it silently validates users in the background and only shows a checkbox as a last resort. No puzzles.

---

## PREREQUISITES (Manual — Do Before Coding)

1. **Get Turnstile credentials from Cloudflare Dashboard:**
   - Go to https://dash.cloudflare.com → **Turnstile** (left sidebar)
   - Click **Add Site**
   - Site name: `Salary Calculator`
   - Domain: `salarycalculator.co.ke`
   - Widget type: **Managed** (recommended — invisible by default)
   - Copy the **Site Key** (public) → used in HTML
   - Copy the **Secret Key** (private) → goes into Supabase Edge Function secret

2. **Add Secret Key to Supabase:**
   ```bash
   supabase secrets set TURNSTILE_SECRET_KEY=<your-secret-key> --project-ref wznopthjoaqusalqoyru
   ```

---

## TASK 1 — Remove hCaptcha from Login Page

**File:** `login.html` (or equivalent)

### Remove all of the following:

```html
<!-- REMOVE: hCaptcha script tag -->
<script src="https://js.hcaptcha.com/1/api.js" async defer></script>

<!-- REMOVE: hCaptcha widget div -->
<div class="h-captcha" data-sitekey="..."></div>
```

Also remove any hCaptcha-related JavaScript in the page or linked `.js` file:
- References to `hcaptcha.getResponse()`
- `hcaptcha.reset()`
- Any `data-callback` or `data-expired-callback` attributes
- Any hCaptcha token being sent to a backend

---

## TASK 2 — Remove hCaptcha from Register/Sign-up Page

**File:** `register.html` (or `signup.html` — whichever exists)

Apply the same removals as Task 1.

---

## TASK 3 — Add Cloudflare Turnstile to Login Page

### Step A: Add the Turnstile script in `<head>` (once, after existing scripts)

```html
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
```

### Step B: Add the Turnstile widget inside the login `<form>`, just above the submit button

```html
<!-- Cloudflare Turnstile -->
<div class="cf-turnstile"
     data-sitekey="REPLACE_WITH_YOUR_SITE_KEY"
     data-theme="light">
</div>
```

> Replace `REPLACE_WITH_YOUR_SITE_KEY` with the actual Site Key from Cloudflare.

### Step C: Update the login form submission JavaScript

Find the existing login submit handler (likely in `login.js` or inline in `login.html`). Update it as follows:

```javascript
// At the top of the submit handler, BEFORE calling Supabase signIn:

async function handleLogin(email, password) {
  // 1. Get Turnstile token
  const turnstileToken = document.querySelector('[name="cf-turnstile-response"]')?.value;

  if (!turnstileToken) {
    showError('Please complete the security check.');
    return;
  }

  // 2. Verify token server-side via Supabase Edge Function
  const verifyRes = await fetch(
    'https://wznopthjoaqusalqoyru.supabase.co/functions/v1/verify-turnstile',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: turnstileToken }),
    }
  );

  const verifyData = await verifyRes.json();

  if (!verifyData.success) {
    showError('Security check failed. Please try again.');
    // Reset the widget so user can retry
    if (window.turnstile) turnstile.reset();
    return;
  }

  // 3. Proceed with Supabase Auth
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    showError(error.message);
    if (window.turnstile) turnstile.reset();
    return;
  }

  // 4. Success — redirect to dashboard
  window.location.href = '/dashboard.html'; // adjust path as needed
}
```

> **Note:** Turnstile automatically injects a hidden input `<input name="cf-turnstile-response">` into the form when validated. The code above reads from that input.

---

## TASK 4 — Add Cloudflare Turnstile to Register/Sign-up Page

Apply the same changes from Task 3 (Steps A, B, C) to `register.html`.

For the register submit handler, verify Turnstile **before** calling `supabase.auth.signUp()`:

```javascript
async function handleRegister(email, password) {
  // 1. Get Turnstile token
  const turnstileToken = document.querySelector('[name="cf-turnstile-response"]')?.value;

  if (!turnstileToken) {
    showError('Please complete the security check.');
    return;
  }

  // 2. Verify token server-side
  const verifyRes = await fetch(
    'https://wznopthjoaqusalqoyru.supabase.co/functions/v1/verify-turnstile',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: turnstileToken }),
    }
  );

  const verifyData = await verifyRes.json();

  if (!verifyData.success) {
    showError('Security check failed. Please try again.');
    if (window.turnstile) turnstile.reset();
    return;
  }

  // 3. Proceed with Supabase sign-up
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    showError(error.message);
    if (window.turnstile) turnstile.reset();
    return;
  }

  // 4. Success — show confirmation or redirect
  showSuccess('Account created! Check your email to confirm.');
}
```

---

## TASK 5 — Create Supabase Edge Function: `verify-turnstile`

**File path:** `supabase/functions/verify-turnstile/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://salarycalculator.co.ke",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ success: false, error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const secretKey = Deno.env.get("TURNSTILE_SECRET_KEY");

    if (!secretKey) {
      console.error("TURNSTILE_SECRET_KEY not set");
      return new Response(JSON.stringify({ success: false, error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Cloudflare's siteverify endpoint
    const formData = new FormData();
    formData.append("secret", secretKey);
    formData.append("response", token);
    // Optionally append remoteip: formData.append("remoteip", req.headers.get("x-forwarded-for") ?? "");

    const cfResponse = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: formData,
      }
    );

    const cfData = await cfResponse.json();

    // cfData.success === true means the token is valid
    return new Response(
      JSON.stringify({ success: cfData.success, error_codes: cfData["error-codes"] ?? [] }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("verify-turnstile error:", err);
    return new Response(JSON.stringify({ success: false, error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

### Deploy the function:

```bash
supabase functions deploy verify-turnstile --project-ref wznopthjoaqusalqoyru
```

---

## TASK 6 — Test Checklist

After deploying, verify the following manually:

### Login page
- [ ] Page loads without hCaptcha widget or script errors in console
- [ ] Turnstile widget appears (or is invisible) near the submit button
- [ ] Submitting with valid credentials → successful login
- [ ] Submitting with wrong credentials → error shown, Turnstile resets
- [ ] Network tab: POST to `verify-turnstile` returns `{ "success": true }`

### Register page
- [ ] Same widget checks as above
- [ ] New account registration completes successfully
- [ ] Confirmation email is received (Zoho SMTP flow intact)

### Edge Function logs
```bash
supabase functions logs verify-turnstile --project-ref wznopthjoaqusalqoyru
```
- [ ] No `TURNSTILE_SECRET_KEY not set` errors
- [ ] Cloudflare siteverify calls returning success

---

## NOTES

- **Turnstile tokens are single-use.** Always call `turnstile.reset()` after a failed attempt so the user gets a fresh token.
- **CORS:** The Edge Function's `Access-Control-Allow-Origin` is locked to `https://salarycalculator.co.ke`. If you test locally (e.g. `localhost:5500`), temporarily add it or use a local secret for dev.
- **No JWT required** for this Edge Function — it's a public endpoint intentionally (no `Authorization` header needed from the client).
- **Turnstile is free** with no monthly limits on Cloudflare's free plan.
