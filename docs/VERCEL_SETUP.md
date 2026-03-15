# Vercel Setup Guide

This document covers everything needed to deploy **Ke-Salary-Calculator** on Vercel
and re-add the environment variables that were previously managed in the Netlify dashboard.

---

## 1. Prerequisites

- A [Vercel account](https://vercel.com/) connected to the MonarCat GitHub organisation
- Node.js 20.x (used by the `/api` serverless functions)
- The `raw-body` npm package (listed in `package.json` – install with `npm install`)

---

## 2. Import the project into Vercel

1. Go to <https://vercel.com/new>
2. Click **"Add GitHub account / organisation"** and grant access to `MonarCat`
3. Select the `Ke-Salary-Calculator` repository
4. Leave **Framework Preset** as *Other* (static site)
5. Set **Root Directory** to `.` (repository root)
6. Leave **Build Command** blank (or `npm run vercel-build` – it's a no-op for this static site)
7. Set **Output Directory** to `.`
8. Click **Deploy**

---

## 3. Environment Variables

Re-add the following variables in
**Vercel → Project → Settings → Environment Variables**
for *Production*, *Preview*, and *Development* environments as needed.

### Ke-Salary-Calculator

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL, e.g. `https://xyzxyz.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase **service-role** key (keep secret – server-side only) |
| `PAYPAL_MODE` | `live` or `sandbox` |

> **Note:** `SUPABASE_SERVICE_KEY` is used only by the `/api/paypal-webhook` serverless
> function and is never exposed to the browser.

---

## 4. Custom Domain

1. Go to **Vercel → Project → Settings → Domains**
2. Add `salarycalculator.co.ke`
3. Update your DNS registrar with the CNAME/A records Vercel provides
4. Once the domain is verified, go to **Supabase → Authentication → URL Configuration**
   and add `https://salarycalculator.co.ke` to the **Redirect URLs** list

---

## 5. PayPal IPN URL

Update the IPN notification URL in your PayPal account
(**Account Settings → Instant Payment Notifications**) to:

```
https://salarycalculator.co.ke/api/paypal-webhook
```

Or, if testing with the Vercel preview URL:

```
https://<your-vercel-project>.vercel.app/api/paypal-webhook
```

Also update any PayPal button HTML that contains a `notify_url` hidden field.

---

## 6. Contact Form

The `contact-us.html` page currently uses Netlify Forms (`netlify` attribute on the
`<form>` element). Netlify Forms will **not** work on Vercel. Choose one of the
following replacements before going live:

- **[Formspree](https://formspree.io/)** – replace the `<form>` action with your
  Formspree endpoint and remove the `netlify` attribute
- **Custom `/api/contact` serverless function** – create `api/contact.mjs` that
  forwards submissions to your email via SendGrid / Resend / similar

---

## 7. Related Repositories

If you are also migrating the Drive Assistant projects, their temporary Vercel URLs are:

| Old Netlify URL | Temporary Vercel URL |
|---|---|
| `da-app.netlify.app` | `da-app.vercel.app` |
| `da-admin.netlify.app` | `da-admin.vercel.app` |

Update any cross-app links once custom domains are configured in Vercel.

---

## 8. Vercel CLI (optional, for local development)

```bash
npm install -g vercel   # install CLI globally
npm install             # install project dependencies (raw-body etc.)
npm run dev             # start local Vercel dev server (functions + static)
npm run deploy          # deploy to production
```
