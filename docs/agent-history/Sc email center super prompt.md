# SC Admin — Email Center Super Prompt
## salarycalculator.co.ke · Google Workspace Business Standard
### Supabase: `wznopthjoaqusalqoyru` · Vercel · Node.js 18+

---

## CONTEXT

The admin dashboard (`admin.html`) is working. The `/api/admin-ops.js` Vercel serverless
function is deployed and confirmed functional. This prompt adds the **Email Center** —
a full in-dashboard email system that lets the admin compose, preview, and send emails
to any segment of users using Google Workspace Business Standard SMTP (Gmail API via
Nodemailer). Six curated templates are included with professional footers.

**Do not touch `admin-ops.js` or existing dashboard logic. Only add the new pieces below.**

---

## PART 1 — SUPABASE: Email Send Log Table

Run in **Supabase → SQL Editor**:

```sql
-- Email send log — every broadcast or transactional send is recorded
CREATE TABLE IF NOT EXISTS email_send_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email     TEXT NOT NULL,
  template_key    TEXT NOT NULL,   -- 'welcome' | 'premium_activated' | etc.
  subject         TEXT NOT NULL,
  target_segment  TEXT NOT NULL,   -- 'all' | 'premium' | 'free' | 'single'
  recipient_count INTEGER NOT NULL DEFAULT 0,
  recipients      TEXT[],          -- array of email addresses sent to
  status          TEXT NOT NULL DEFAULT 'sent',   -- 'sent' | 'failed' | 'partial'
  error_message   TEXT,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only admin (service role) can read/write this table
ALTER TABLE email_send_log ENABLE ROW LEVEL SECURITY;
-- No public policies — service role bypasses RLS entirely

-- Index for fast log queries
CREATE INDEX IF NOT EXISTS idx_email_log_sent ON email_send_log (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_admin ON email_send_log (admin_email);
```

---

## PART 2 — GOOGLE WORKSPACE SMTP SETUP

### 2A — Generate an App Password

1. Sign in to your Google Workspace admin account
2. Go to **myaccount.google.com → Security → 2-Step Verification** (must be ON)
3. Scroll down to **App passwords**
4. Select app: **Mail** · device: **Other** → type `SC Admin Dashboard`
5. Google gives you a **16-character password** — copy it, you only see it once
6. This is `GMAIL_APP_PASSWORD` in your Vercel env vars

### 2B — Vercel Environment Variables

Add these in **Vercel Dashboard → Settings → Environment Variables**:

| Variable | Value |
|----------|-------|
| `GMAIL_USER` | Your Google Workspace email — e.g. `admin@salarycalculator.co.ke` |
| `GMAIL_APP_PASSWORD` | The 16-char App Password from Step 2A |
| `GMAIL_FROM_NAME` | `Salary Calculator Kenya` |
| `SUPABASE_SERVICE_ROLE_KEY` | Already set (from admin-ops) |
| `SUPABASE_ANON_KEY` | Already set (from admin-ops) |
| `ADMIN_EMAILS` | Already set (from admin-ops) |

### 2C — Install Nodemailer

```bash
npm install nodemailer
```

Add to your `package.json` if not already there.

---

## PART 3 — `/api/send-email.js` Vercel Serverless Function

**File:** `/api/send-email.js`

```javascript
// /api/send-email.js
// Sends transactional or broadcast emails via Google Workspace SMTP (Nodemailer)
// Called from admin.html Email Center

import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin':  'https://salarycalculator.co.ke',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const SUPA_URL  = 'https://wznopthjoaqusalqoyru.supabase.co';
const SVC_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY  = process.env.SUPABASE_ANON_KEY;
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'kesalarycalculator@gmail.com')
  .split(',').map(e => e.trim().toLowerCase());

// Google Workspace SMTP transporter
function createTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,         // STARTTLS on 587
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    pool: true,            // reuse connections for bulk send
    maxConnections: 3,
    rateDelta: 1000,       // 1 second between connection reuses
    rateLimit: 10,         // max 10 messages per rateDelta
  });
}

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  // ── Verify admin session ──────────────────────────────────────────────────
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'No token' });
  const callerSb = createClient(SUPA_URL, ANON_KEY);
  const { data: { user: caller } } = await callerSb.auth.getUser(token);
  if (!caller || !ADMIN_EMAILS.includes(caller.email?.toLowerCase())) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const admin = createClient(SUPA_URL, SVC_KEY);
  const { template_key, subject, html_body, text_body, target, single_email } = req.body;

  if (!subject || !html_body) {
    return res.status(400).json({ error: 'subject and html_body are required' });
  }

  // ── Build recipient list from Supabase ────────────────────────────────────
  let recipients = [];

  if (target === 'single') {
    if (!single_email) return res.status(400).json({ error: 'single_email required' });
    // Fetch the user's profile for personalisation
    const { data } = await admin.from('user_profiles')
      .select('email, full_name, premium_expires_at, premium_source')
      .eq('email', single_email.toLowerCase())
      .single();
    recipients = [{ email: single_email, name: data?.full_name || single_email.split('@')[0], ...data }];

  } else {
    let query = admin.from('user_profiles')
      .select('email, full_name, premium_expires_at, premium_source');

    if (target === 'premium') {
      query = query.gt('premium_expires_at', new Date().toISOString());
    } else if (target === 'free') {
      query = query.or(`premium_expires_at.is.null,premium_expires_at.lte.${new Date().toISOString()}`);
    }
    // 'all' — no filter

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    recipients = (data || []).map(u => ({
      ...u,
      name: u.full_name || (u.email || '').split('@')[0],
    }));
  }

  if (!recipients.length) {
    return res.json({ success: true, sent: 0, message: 'No recipients in that segment' });
  }

  // ── Send emails ───────────────────────────────────────────────────────────
  const transporter = createTransporter();
  const FROM = `"${process.env.GMAIL_FROM_NAME || 'Salary Calculator Kenya'}" <${process.env.GMAIL_USER}>`;
  let sent = 0;
  let failed = 0;
  const errors = [];

  // Personalise and send each email
  // For large lists, sends sequentially with a 150ms delay to respect Gmail rate limits
  for (const r of recipients) {
    const personalHtml  = personalise(html_body,  r);
    const personalText  = personalise(text_body || stripHtml(html_body), r);
    const personalSubj  = personalise(subject, r);

    try {
      await transporter.sendMail({
        from:    FROM,
        to:      r.email,
        subject: personalSubj,
        html:    wrapInEmailShell(personalHtml),
        text:    personalText,
        headers: {
          'List-Unsubscribe': `<https://salarycalculator.co.ke/account.html?unsubscribe=1>`,
          'X-Mailer': 'SC Admin Dashboard',
        },
      });
      sent++;
    } catch (e) {
      failed++;
      errors.push(`${r.email}: ${e.message}`);
      console.error('[send-email] Failed to send to', r.email, e.message);
    }

    // Throttle — 150ms between emails
    if (recipients.length > 1) await delay(150);
  }

  transporter.close();

  // ── Log the send ──────────────────────────────────────────────────────────
  await admin.from('email_send_log').insert({
    admin_email:     caller.email,
    template_key:    template_key || 'custom',
    subject,
    target_segment:  target,
    recipient_count: sent,
    recipients:      recipients.slice(0, 100).map(r => r.email), // store first 100
    status:          failed === 0 ? 'sent' : sent === 0 ? 'failed' : 'partial',
    error_message:   errors.length ? errors.slice(0, 5).join('; ') : null,
  }).catch(e => console.error('[send-email] Log error:', e.message));

  return res.json({
    success: true,
    sent,
    failed,
    total: recipients.length,
    errors: errors.slice(0, 3),
  });
}

// ── Template variable substitution ───────────────────────────────────────────
function personalise(text, user) {
  const expiry = user.premium_expires_at
    ? new Date(user.premium_expires_at).toLocaleDateString('en-KE', {
        year: 'numeric', month: 'long', day: 'numeric'
      })
    : 'N/A';
  const plan = user.premium_expires_at && new Date(user.premium_expires_at) > new Date()
    ? 'Premium' : 'Free';
  return (text || '')
    .replace(/\{\{name\}\}/g,         user.name   || 'there')
    .replace(/\{\{email\}\}/g,        user.email  || '')
    .replace(/\{\{plan\}\}/g,         plan)
    .replace(/\{\{expires\}\}/g,      expiry)
    .replace(/\{\{upgrade_link\}\}/g, 'https://salarycalculator.co.ke/#pricing');
}

// Wrap body HTML in the full email shell (header + footer)
function wrapInEmailShell(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Salary Calculator Kenya</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Georgia,'Times New Roman',serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

      <!-- HEADER -->
      <tr><td style="background:#060b18;border-radius:12px 12px 0 0;padding:28px 40px;text-align:center">
        <div style="font-family:Arial,sans-serif;font-size:22px;font-weight:900;color:#00d4aa;letter-spacing:-0.5px">
          ⚡ Salary Calculator Kenya
        </div>
        <div style="font-size:12px;color:#4f6280;margin-top:4px;font-family:Arial,sans-serif;letter-spacing:2px">
          SALARYCALCULATOR.CO.KE
        </div>
      </td></tr>

      <!-- BODY -->
      <tr><td style="background:#ffffff;padding:40px;font-size:15px;line-height:1.8;color:#1a2540">
        ${bodyHtml}
      </td></tr>

      <!-- FOOTER -->
      ${EMAIL_FOOTER}

    </table>
  </td></tr>
</table>
</body></html>`;
}

const EMAIL_FOOTER = `
<tr><td style="background:#f4f6f9;border-top:2px solid #e2e8f0;border-radius:0 0 12px 12px;padding:28px 40px">
  <!-- Brand line -->
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="text-align:center;padding-bottom:16px">
        <div style="font-family:Arial,sans-serif;font-size:13px;font-weight:700;color:#00d4aa">
          ⚡ Salary Calculator Kenya
        </div>
        <div style="font-size:11px;color:#8fa3c8;margin-top:3px;font-family:Arial,sans-serif">
          Kenya's most accurate payslip calculator · Powered by MonarCat
        </div>
      </td>
    </tr>

    <!-- Tax rates notice -->
    <tr>
      <td style="background:#eef9f6;border:1px solid #c3ede6;border-radius:8px;padding:10px 16px;margin-bottom:16px;text-align:center">
        <div style="font-size:11px;color:#006b54;font-family:Arial,sans-serif;line-height:1.6">
          <strong>FY 2025/2026 Tax Rates Active</strong><br>
          PAYE (up to 35%) &nbsp;·&nbsp; NSSF Tier I &amp; II &nbsp;·&nbsp; SHIF 2.75% &nbsp;·&nbsp; Housing Levy 1.5%<br>
          Personal Relief: KES 2,400/month
        </div>
      </td>
    </tr>

    <!-- Divider -->
    <tr><td style="padding:12px 0">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="border-top:1px solid #e2e8f0"></td>
        </tr>
      </table>
    </td></tr>

    <!-- Links -->
    <tr>
      <td style="text-align:center;padding-bottom:12px">
        <a href="https://salarycalculator.co.ke/calculator.html"
           style="font-size:12px;color:#00a88a;text-decoration:none;font-family:Arial,sans-serif;margin:0 8px">
          Calculator
        </a>
        <span style="color:#cbd5e1;font-size:12px">|</span>
        <a href="https://salarycalculator.co.ke/blog.html"
           style="font-size:12px;color:#00a88a;text-decoration:none;font-family:Arial,sans-serif;margin:0 8px">
          Blog
        </a>
        <span style="color:#cbd5e1;font-size:12px">|</span>
        <a href="https://salarycalculator.co.ke/account.html"
           style="font-size:12px;color:#00a88a;text-decoration:none;font-family:Arial,sans-serif;margin:0 8px">
          My Account
        </a>
        <span style="color:#cbd5e1;font-size:12px">|</span>
        <a href="https://salarycalculator.co.ke/contact-us.html"
           style="font-size:12px;color:#00a88a;text-decoration:none;font-family:Arial,sans-serif;margin:0 8px">
          Contact Us
        </a>
      </td>
    </tr>

    <!-- Legal -->
    <tr>
      <td style="text-align:center">
        <div style="font-size:11px;color:#94a3b8;font-family:Arial,sans-serif;line-height:1.7">
          &copy; 2025 Salary Calculator Kenya &mdash; A MonarCat Product<br>
          Nairobi, Kenya &nbsp;&middot;&nbsp; Registered in Kenya<br>
          <br>
          You are receiving this email because you have an account at salarycalculator.co.ke.<br>
          <a href="https://salarycalculator.co.ke/account.html?unsubscribe=1"
             style="color:#94a3b8;text-decoration:underline">Unsubscribe</a>
          &nbsp;&middot;&nbsp;
          <a href="https://salarycalculator.co.ke/privacy-policy.html"
             style="color:#94a3b8;text-decoration:underline">Privacy Policy</a>
          &nbsp;&middot;&nbsp;
          <a href="https://salarycalculator.co.ke/terms.html"
             style="color:#94a3b8;text-decoration:underline">Terms of Use</a>
        </div>
      </td>
    </tr>
  </table>
</td></tr>`;

function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## PART 4 — EMAIL TEMPLATES

All 6 templates. These are the **body HTML only** — the shell (header + footer) is
added automatically by `wrapInEmailShell()`. Use `{{name}}`, `{{email}}`, `{{plan}}`,
`{{expires}}`, `{{upgrade_link}}` as personalisation tokens.

Store these in the admin.html script as a `const TEMPLATES` object (see Part 5).

---

### TEMPLATE 1 — Welcome Email

**Key:** `welcome`
**Trigger:** New user signs up

```html
<!-- SUBJECT: Welcome to Salary Calculator Kenya 🎉 -->
<p style="font-size:17px;margin:0 0 20px">Hello {{name}},</p>

<p style="margin:0 0 16px">
  Welcome to <strong>Salary Calculator Kenya</strong> — the most accurate payslip
  calculator for Kenyan employees and HR professionals. We're glad you're here.
</p>

<p style="margin:0 0 20px">Here's what you can do right now:</p>

<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
  <tr>
    <td style="padding:10px 0;border-bottom:1px solid #e2e8f0">
      <span style="color:#00d4aa;font-size:16px">✅</span>
      <strong style="margin-left:8px">Calculate your net salary</strong>
      <div style="margin-left:28px;font-size:13px;color:#64748b">
        PAYE, NSSF, SHIF, Housing Levy — all FY 2025/2026 rates
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:10px 0;border-bottom:1px solid #e2e8f0">
      <span style="color:#00d4aa;font-size:16px">✅</span>
      <strong style="margin-left:8px">Generate professional payslips</strong>
      <div style="margin-left:28px;font-size:13px;color:#64748b">
        Download and share with your employer or employees
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:10px 0;border-bottom:1px solid #e2e8f0">
      <span style="color:#00d4aa;font-size:16px">✅</span>
      <strong style="margin-left:8px">Explore salary benchmarks</strong>
      <div style="margin-left:28px;font-size:13px;color:#64748b">
        See what professionals in your role earn in Kenya
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:10px 0">
      <span style="color:#f5c842;font-size:16px">⭐</span>
      <strong style="margin-left:8px">Upgrade to Premium</strong>
      <div style="margin-left:28px;font-size:13px;color:#64748b">
        Watermark-free PDF payslips, P9A tax form, Payroll Import — from KES 499/month
      </div>
    </td>
  </tr>
</table>

<table cellpadding="0" cellspacing="0" style="margin:28px 0">
  <tr>
    <td style="background:#00d4aa;border-radius:8px;text-align:center">
      <a href="https://salarycalculator.co.ke/calculator.html"
         style="display:block;padding:14px 32px;color:#03120f;font-size:15px;font-weight:700;text-decoration:none;font-family:Arial,sans-serif;letter-spacing:0.3px">
        Start Calculating →
      </a>
    </td>
  </tr>
</table>

<p style="color:#64748b;font-size:13px;margin-top:24px">
  If you have any questions, reply to this email or visit our
  <a href="https://salarycalculator.co.ke/contact-us.html" style="color:#00a88a">contact page</a>.
  We typically respond within one business day.
</p>

<p style="margin-top:24px;color:#1a2540">
  Asante sana,<br>
  <strong>Moses &amp; The SC Team</strong><br>
  <span style="font-size:12px;color:#94a3b8">Salary Calculator Kenya</span>
</p>
```

---

### TEMPLATE 2 — Premium Activated

**Key:** `premium_activated`
**Trigger:** After Paystack payment or admin grant

```html
<!-- SUBJECT: ⭐ Your Premium Access is Now Active -->
<p style="font-size:17px;margin:0 0 20px">Hello {{name}},</p>

<div style="background:linear-gradient(135deg,#fef9e7,#fffbf0);border:2px solid #f5c842;border-radius:12px;padding:20px 24px;margin-bottom:24px;text-align:center">
  <div style="font-size:32px;margin-bottom:8px">⭐</div>
  <div style="font-size:20px;font-weight:700;color:#92650a;font-family:Arial,sans-serif">
    Premium Access Activated
  </div>
  <div style="font-size:13px;color:#b07d12;margin-top:6px;font-family:Arial,sans-serif">
    Plan: <strong>{{plan}}</strong> &nbsp;·&nbsp; Active until: <strong>{{expires}}</strong>
  </div>
</div>

<p style="margin:0 0 16px">You now have full access to everything Premium:</p>

<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
  <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0">
    <span style="color:#f5c842;font-size:16px">⭐</span>
    <strong style="margin-left:8px">Clean, watermark-free PDF payslips</strong>
    <div style="margin-left:28px;font-size:13px;color:#64748b">Professional-grade, KRA-compliant format</div>
  </td></tr>
  <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0">
    <span style="color:#f5c842;font-size:16px">📋</span>
    <strong style="margin-left:8px">P9A Annual Tax Return Form</strong>
    <div style="margin-left:28px;font-size:13px;color:#64748b">Generate your P9A for KRA filing instantly</div>
  </td></tr>
  <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0">
    <span style="color:#f5c842;font-size:16px">📊</span>
    <strong style="margin-left:8px">Payroll Import</strong>
    <div style="margin-left:28px;font-size:13px;color:#64748b">Bulk process employee payroll from CSV</div>
  </td></tr>
  <tr><td style="padding:10px 0">
    <span style="color:#f5c842;font-size:16px">📈</span>
    <strong style="margin-left:8px">Full calculation history</strong>
    <div style="margin-left:28px;font-size:13px;color:#64748b">Save and revisit all your payslips</div>
  </td></tr>
</table>

<table cellpadding="0" cellspacing="0" style="margin:24px 0">
  <tr>
    <td style="background:#060b18;border-radius:8px">
      <a href="https://salarycalculator.co.ke/payslip-generator-kenya.html"
         style="display:block;padding:14px 32px;color:#00d4aa;font-size:15px;font-weight:700;text-decoration:none;font-family:Arial,sans-serif">
        Generate Your First Premium Payslip →
      </a>
    </td>
  </tr>
</table>

<p style="color:#64748b;font-size:13px;margin-top:8px">
  <strong>Renewal reminder:</strong> Your Premium subscription is active until
  <strong>{{expires}}</strong>. You'll receive a reminder 3 days before it expires.
</p>

<p style="margin-top:24px;color:#1a2540">
  Thank you for supporting Salary Calculator Kenya,<br>
  <strong>Moses &amp; The SC Team</strong><br>
  <span style="font-size:12px;color:#94a3b8">Salary Calculator Kenya</span>
</p>
```

---

### TEMPLATE 3 — Premium Expiring (3-day reminder)

**Key:** `premium_expiring`
**Trigger:** 3 days before `premium_expires_at`

```html
<!-- SUBJECT: ⏰ Your Premium expires in 3 days — renew to keep your payslips clean -->
<p style="font-size:17px;margin:0 0 20px">Hello {{name}},</p>

<div style="background:#fff8f0;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px">
  <div style="font-size:14px;font-weight:700;color:#92400e;font-family:Arial,sans-serif">
    ⏰ Your Premium subscription expires on <strong>{{expires}}</strong>
  </div>
  <div style="font-size:13px;color:#b45309;margin-top:4px;font-family:Arial,sans-serif">
    After that, your payslips will display a watermark and premium features will be locked.
  </div>
</div>

<p style="margin:0 0 16px">
  Renew today to keep uninterrupted access to:
</p>

<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
  <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">
    <span style="color:#00d4aa">✓</span>
    <span style="margin-left:8px">Watermark-free PDF payslips</span>
  </td></tr>
  <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">
    <span style="color:#00d4aa">✓</span>
    <span style="margin-left:8px">P9A Annual Tax Return Form</span>
  </td></tr>
  <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">
    <span style="color:#00d4aa">✓</span>
    <span style="margin-left:8px">Payroll Import from CSV</span>
  </td></tr>
  <tr><td style="padding:8px 0">
    <span style="color:#00d4aa">✓</span>
    <span style="margin-left:8px">Full calculation history</span>
  </td></tr>
</table>

<!-- Pricing cards -->
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
  <tr>
    <td width="48%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center">
      <div style="font-size:12px;color:#64748b;font-family:Arial,sans-serif;margin-bottom:4px">MONTHLY</div>
      <div style="font-size:26px;font-weight:900;color:#1a2540;font-family:Arial,sans-serif">KES 499</div>
      <div style="font-size:11px;color:#94a3b8;font-family:Arial,sans-serif">/month</div>
    </td>
    <td width="4%"></td>
    <td width="48%" style="background:#060b18;border:2px solid #00d4aa;border-radius:10px;padding:16px;text-align:center">
      <div style="font-size:10px;color:#00d4aa;font-family:Arial,sans-serif;margin-bottom:4px;letter-spacing:1px">BEST VALUE</div>
      <div style="font-size:26px;font-weight:900;color:#ffffff;font-family:Arial,sans-serif">KES 4,999</div>
      <div style="font-size:11px;color:#4f6280;font-family:Arial,sans-serif">/year · save KES 989</div>
    </td>
  </tr>
</table>

<table cellpadding="0" cellspacing="0" style="margin:0 auto 24px">
  <tr>
    <td style="background:#00d4aa;border-radius:8px">
      <a href="{{upgrade_link}}"
         style="display:block;padding:14px 40px;color:#03120f;font-size:15px;font-weight:700;text-decoration:none;font-family:Arial,sans-serif">
        Renew Premium Now →
      </a>
    </td>
  </tr>
</table>

<p style="color:#64748b;font-size:13px">
  If you have any questions about your subscription, just reply to this email.
</p>

<p style="margin-top:24px;color:#1a2540">
  Asante,<br>
  <strong>The SC Team</strong><br>
  <span style="font-size:12px;color:#94a3b8">Salary Calculator Kenya</span>
</p>
```

---

### TEMPLATE 4 — Premium Expired / Winback

**Key:** `premium_expired`
**Trigger:** After `premium_expires_at` passes

```html
<!-- SUBJECT: 🔒 Your Premium has expired — your payslips now have a watermark -->
<p style="font-size:17px;margin:0 0 20px">Hello {{name}},</p>

<div style="background:#fff1f2;border-left:4px solid #ff4d6d;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px">
  <div style="font-size:14px;font-weight:700;color:#9f1239;font-family:Arial,sans-serif">
    🔒 Your Premium subscription expired on <strong>{{expires}}</strong>
  </div>
  <div style="font-size:13px;color:#be123c;margin-top:4px;font-family:Arial,sans-serif">
    Your payslips now display a "SAMPLE" watermark. Upgrade again to restore clean payslips.
  </div>
</div>

<p style="margin:0 0 20px">
  We'd love to have you back. Re-activating Premium takes under 2 minutes and
  your history is still there waiting for you.
</p>

<div style="background:#f8fafc;border-radius:10px;padding:20px;margin-bottom:24px;text-align:center">
  <div style="font-size:13px;color:#64748b;font-family:Arial,sans-serif;margin-bottom:12px">
    Resume from where you left off
  </div>
  <table cellpadding="0" cellspacing="0" style="margin:0 auto">
    <tr>
      <td style="background:#00d4aa;border-radius:8px">
        <a href="{{upgrade_link}}"
           style="display:block;padding:14px 36px;color:#03120f;font-size:15px;font-weight:700;text-decoration:none;font-family:Arial,sans-serif">
          Re-activate Premium →
        </a>
      </td>
    </tr>
  </table>
  <div style="font-size:12px;color:#94a3b8;margin-top:10px;font-family:Arial,sans-serif">
    Monthly plan from <strong>KES 499</strong> · Annual plan from <strong>KES 4,999</strong>
  </div>
</div>

<p style="font-size:13px;color:#64748b">
  Not ready to re-subscribe? You can still use the free calculator — your payslips
  will just have a watermark. Upgrade anytime from your
  <a href="https://salarycalculator.co.ke/account.html" style="color:#00a88a">account page</a>.
</p>

<p style="margin-top:24px;color:#1a2540">
  Hope to see you back,<br>
  <strong>Moses &amp; The SC Team</strong><br>
  <span style="font-size:12px;color:#94a3b8">Salary Calculator Kenya</span>
</p>
```

---

### TEMPLATE 5 — Upgrade Nudge (free user upsell)

**Key:** `upgrade_nudge`
**Trigger:** Manual broadcast to free users

```html
<!-- SUBJECT: 🚀 Unlock clean payslips for KES 499 — no watermarks -->
<p style="font-size:17px;margin:0 0 20px">Hello {{name}},</p>

<p style="margin:0 0 20px">
  You've been using Salary Calculator Kenya — thank you! We noticed you're on
  the free plan, which is great for quick calculations. But if you generate
  payslips regularly, Premium makes a real difference.
</p>

<!-- Before/after comparison -->
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
  <tr>
    <td width="47%" style="background:#fff1f2;border:1px solid #fecdd3;border-radius:10px;padding:16px;text-align:center;vertical-align:top">
      <div style="font-size:11px;font-weight:700;color:#9f1239;font-family:Arial,sans-serif;letter-spacing:1px;margin-bottom:8px">FREE PLAN</div>
      <div style="font-size:28px;margin-bottom:8px">🔒</div>
      <div style="font-size:13px;color:#64748b;font-family:Arial,sans-serif">
        Payslips with<br><strong>"SAMPLE"</strong> watermark<br><br>
        ✗ No P9A form<br>
        ✗ No payroll import<br>
        ✗ No clean PDFs
      </div>
    </td>
    <td width="6%" style="text-align:center;font-size:20px;color:#94a3b8">→</td>
    <td width="47%" style="background:#eef9f6;border:2px solid #00d4aa;border-radius:10px;padding:16px;text-align:center;vertical-align:top">
      <div style="font-size:11px;font-weight:700;color:#006b54;font-family:Arial,sans-serif;letter-spacing:1px;margin-bottom:8px">PREMIUM</div>
      <div style="font-size:28px;margin-bottom:8px">⭐</div>
      <div style="font-size:13px;color:#1a2540;font-family:Arial,sans-serif">
        Clean, professional PDFs<br>ready to send<br><br>
        ✓ P9A tax form<br>
        ✓ Payroll import<br>
        ✓ No watermarks
      </div>
    </td>
  </tr>
</table>

<div style="background:#f8fafc;border-radius:10px;padding:20px;margin-bottom:24px;text-align:center">
  <div style="font-size:24px;font-weight:900;color:#1a2540;font-family:Arial,sans-serif">
    KES 499 <span style="font-size:14px;font-weight:400;color:#64748b">/month</span>
  </div>
  <div style="font-size:12px;color:#94a3b8;font-family:Arial,sans-serif;margin-bottom:14px">
    Less than a cup of coffee a week
  </div>
  <table cellpadding="0" cellspacing="0" style="margin:0 auto">
    <tr>
      <td style="background:#00d4aa;border-radius:8px">
        <a href="{{upgrade_link}}"
           style="display:block;padding:13px 36px;color:#03120f;font-size:15px;font-weight:700;text-decoration:none;font-family:Arial,sans-serif">
          Upgrade to Premium →
        </a>
      </td>
    </tr>
  </table>
  <div style="font-size:11px;color:#94a3b8;margin-top:10px;font-family:Arial,sans-serif">
    Cancel anytime · No hidden fees · Payable via M-Pesa or card
  </div>
</div>

<p style="font-size:13px;color:#64748b">
  Have a question before upgrading? Reply to this email — we'll get back to you
  within one business day.
</p>

<p style="margin-top:24px;color:#1a2540">
  Cheers,<br>
  <strong>Moses &amp; The SC Team</strong><br>
  <span style="font-size:12px;color:#94a3b8">Salary Calculator Kenya</span>
</p>
```

---

### TEMPLATE 6 — Custom Broadcast

**Key:** `custom`
**Trigger:** Admin writes freely — blank compose

```html
<!-- SUBJECT: (admin fills in) -->
<p style="font-size:17px;margin:0 0 20px">Hello {{name}},</p>

<p style="margin:0 0 16px">
  (Write your message here. Use {{name}}, {{email}}, {{plan}}, {{expires}},
  {{upgrade_link}} to personalise for each recipient.)
</p>

<p style="margin-top:32px;color:#1a2540">
  Best regards,<br>
  <strong>The SC Team</strong><br>
  <span style="font-size:12px;color:#94a3b8">Salary Calculator Kenya</span>
</p>
```

---

## PART 5 — `admin.html` ADDITIONS

Make these three additions to the existing `admin.html`. Do not change existing code.

### 5A — Add Email nav button

In the `<div class="nav">` inside `<aside id="sidebar">`, add after the Revenue button:

```html
<button data-section="email" onclick="showSection('email',this)">✉️ Email Center</button>
```

### 5B — Add Email Center HTML section

After `</section>` closing the revenue section (line ~91), add:

```html
<section id="section-email" class="section">

  <div style="display:grid;grid-template-columns:260px 1fr;gap:12px">

    <!-- LEFT: Template list + Send log -->
    <div>
      <div style="font:700 10px var(--mono);color:var(--text3);letter-spacing:1px;margin-bottom:8px">TEMPLATES</div>
      <div id="template-list" style="display:grid;gap:6px;margin-bottom:20px">
        <!-- Rendered by JS -->
      </div>

      <div style="font:700 10px var(--mono);color:var(--text3);letter-spacing:1px;margin-bottom:8px">SEND HISTORY</div>
      <div id="send-log" style="display:grid;gap:6px">
        <div style="font-size:12px;color:var(--text3)">No emails sent yet.</div>
      </div>
    </div>

    <!-- RIGHT: Compose -->
    <div class="card">
      <div class="field">
        <label>Send To</label>
        <select id="email-target" onchange="onTargetChange()">
          <option value="all">📋 All Users</option>
          <option value="premium">⭐ Premium Users Only</option>
          <option value="free">🆓 Free Users Only</option>
          <option value="single">👤 Specific User</option>
        </select>
      </div>
      <div id="single-email-wrap" class="field" style="display:none">
        <label>User Email</label>
        <input id="single-email-input" type="email" placeholder="user@example.com">
      </div>
      <div class="field">
        <label>Subject Line</label>
        <input id="email-subject" type="text" placeholder="Your subject line...">
      </div>
      <div class="field">
        <label>Personalisation Tokens</label>
        <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px">
          <button class="act-btn" onclick="insertToken('{{name}}')">{{name}}</button>
          <button class="act-btn" onclick="insertToken('{{email}}')">{{email}}</button>
          <button class="act-btn" onclick="insertToken('{{plan}}')">{{plan}}</button>
          <button class="act-btn" onclick="insertToken('{{expires}}')">{{expires}}</button>
          <button class="act-btn" onclick="insertToken('{{upgrade_link}}')">{{upgrade_link}}</button>
        </div>
        <label>Message Body (HTML supported)</label>
        <textarea id="email-body" style="min-height:260px;font-family:var(--mono);font-size:12px"></textarea>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div style="font:12px var(--mono);color:var(--text3)" id="recipient-count-label">to — recipients</div>
        <div style="display:flex;gap:8px">
          <button class="btn" onclick="previewEmail()">👁 Preview</button>
          <button id="send-email-btn" class="btn primary" onclick="sendEmail()">✉️ Send Email</button>
        </div>
      </div>

      <!-- Preview box -->
      <div id="email-preview-box" style="display:none;margin-top:16px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:16px">
        <div style="font:700 10px var(--mono);color:var(--text3);margin-bottom:8px">PREVIEW (personalised as first recipient)</div>
        <div style="font-size:13px;color:var(--text3);margin-bottom:4px">Subject: <strong id="preview-subject" style="color:var(--text)">—</strong></div>
        <div style="font-size:12px;color:var(--text2);line-height:1.7;white-space:pre-wrap;max-height:200px;overflow:auto" id="preview-body">—</div>
      </div>
    </div>

  </div>
</section>
```

### 5C — Add Email Center JS

Add these functions to the existing `<script>` block, before the `init();` call:

```javascript
// ── EMAIL TEMPLATES ───────────────────────────────────────────────────────────
const TEMPLATES = {
  welcome: {
    label: '👋 Welcome Email',
    desc: 'New user onboarding',
    tag: 'TRANSACTIONAL',
    subject: 'Welcome to Salary Calculator Kenya 🎉',
    body: `<p style="font-size:17px;margin:0 0 20px">Hello {{name}},</p>\n\n<p style="margin:0 0 16px">Welcome to <strong>Salary Calculator Kenya</strong> — Kenya's most accurate payslip calculator. We're glad you're here.</p>\n\n<p style="margin:0 0 20px">Get started by calculating your net salary — all FY 2025/2026 rates included (PAYE, NSSF, SHIF 2.75%, Housing Levy 1.5%).</p>\n\n<table cellpadding="0" cellspacing="0" style="margin:24px 0">\n  <tr>\n    <td style="background:#00d4aa;border-radius:8px">\n      <a href="https://salarycalculator.co.ke/calculator.html"\n         style="display:block;padding:14px 32px;color:#03120f;font-size:15px;font-weight:700;text-decoration:none;font-family:Arial,sans-serif">\n        Start Calculating →\n      </a>\n    </td>\n  </tr>\n</table>\n\n<p style="margin-top:24px;color:#1a2540">Asante sana,<br><strong>Moses &amp; The SC Team</strong></p>`,
  },
  premium_activated: {
    label: '⭐ Premium Activated',
    desc: 'After payment or admin grant',
    tag: 'TRANSACTIONAL',
    subject: '⭐ Your Premium Access is Now Active',
    body: `<p style="font-size:17px;margin:0 0 20px">Hello {{name}},</p>\n\n<div style="background:#fef9e7;border:2px solid #f5c842;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center">\n  <div style="font-size:28px;margin-bottom:6px">⭐</div>\n  <div style="font-size:18px;font-weight:700;color:#92650a;font-family:Arial,sans-serif">Premium Access Active</div>\n  <div style="font-size:13px;color:#b07d12;margin-top:4px;font-family:Arial,sans-serif">Active until: <strong>{{expires}}</strong></div>\n</div>\n\n<p>You now have watermark-free payslips, P9A form generation, and Payroll Import.</p>\n\n<table cellpadding="0" cellspacing="0" style="margin:24px 0">\n  <tr>\n    <td style="background:#060b18;border-radius:8px">\n      <a href="https://salarycalculator.co.ke/payslip-generator-kenya.html"\n         style="display:block;padding:14px 32px;color:#00d4aa;font-size:15px;font-weight:700;text-decoration:none;font-family:Arial,sans-serif">\n        Generate Premium Payslip →\n      </a>\n    </td>\n  </tr>\n</table>\n\n<p style="margin-top:24px;color:#1a2540">Thank you,<br><strong>Moses &amp; The SC Team</strong></p>`,
  },
  premium_expiring: {
    label: '⏰ Premium Expiring',
    desc: '3-day renewal reminder',
    tag: 'RETENTION',
    subject: '⏰ Your Premium expires in 3 days — renew now',
    body: `<p style="font-size:17px;margin:0 0 20px">Hello {{name}},</p>\n\n<div style="background:#fff8f0;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px">\n  <div style="font-size:14px;font-weight:700;color:#92400e;font-family:Arial,sans-serif">⏰ Your Premium expires on <strong>{{expires}}</strong></div>\n  <div style="font-size:13px;color:#b45309;margin-top:4px;font-family:Arial,sans-serif">Payslips will display a watermark after this date.</div>\n</div>\n\n<p>Renew today to keep your clean payslips and premium features.</p>\n\n<table cellpadding="0" cellspacing="0" style="margin:24px auto">\n  <tr>\n    <td style="background:#00d4aa;border-radius:8px">\n      <a href="{{upgrade_link}}"\n         style="display:block;padding:14px 36px;color:#03120f;font-size:15px;font-weight:700;text-decoration:none;font-family:Arial,sans-serif">\n        Renew Premium →\n      </a>\n    </td>\n  </tr>\n</table>\n\n<p style="margin-top:24px;color:#1a2540">Asante,<br><strong>The SC Team</strong></p>`,
  },
  premium_expired: {
    label: '🔒 Premium Expired',
    desc: 'Winback after expiry',
    tag: 'WINBACK',
    subject: '🔒 Your Premium has expired — re-activate to restore clean payslips',
    body: `<p style="font-size:17px;margin:0 0 20px">Hello {{name}},</p>\n\n<div style="background:#fff1f2;border-left:4px solid #ff4d6d;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px">\n  <div style="font-size:14px;font-weight:700;color:#9f1239;font-family:Arial,sans-serif">🔒 Your Premium subscription has expired</div>\n  <div style="font-size:13px;color:#be123c;margin-top:4px;font-family:Arial,sans-serif">Your payslips now show a watermark. Re-activate to restore full access.</div>\n</div>\n\n<p>We'd love to have you back. Your history is still saved.</p>\n\n<table cellpadding="0" cellspacing="0" style="margin:24px auto">\n  <tr>\n    <td style="background:#00d4aa;border-radius:8px">\n      <a href="{{upgrade_link}}"\n         style="display:block;padding:14px 36px;color:#03120f;font-size:15px;font-weight:700;text-decoration:none;font-family:Arial,sans-serif">\n        Re-activate Premium →\n      </a>\n    </td>\n  </tr>\n</table>\n\n<p style="margin-top:24px;color:#1a2540">Hope to see you back,<br><strong>Moses &amp; The SC Team</strong></p>`,
  },
  upgrade_nudge: {
    label: '🚀 Upgrade Nudge',
    desc: 'Free user upsell',
    tag: 'MARKETING',
    subject: '🚀 Unlock clean payslips for KES 499 — no watermarks',
    body: `<p style="font-size:17px;margin:0 0 20px">Hello {{name}},</p>\n\n<p style="margin:0 0 20px">You've been using Salary Calculator — thank you! If you generate payslips regularly, Premium makes a real difference.</p>\n\n<div style="background:#eef9f6;border:2px solid #00d4aa;border-radius:10px;padding:20px;margin-bottom:24px;text-align:center">\n  <div style="font-size:22px;font-weight:900;color:#1a2540;font-family:Arial,sans-serif">KES 499<span style="font-size:14px;font-weight:400;color:#64748b">/month</span></div>\n  <div style="font-size:12px;color:#64748b;font-family:Arial,sans-serif;margin:4px 0 14px">Watermark-free PDFs · P9A form · Payroll Import</div>\n  <table cellpadding="0" cellspacing="0" style="margin:0 auto">\n    <tr>\n      <td style="background:#00d4aa;border-radius:8px">\n        <a href="{{upgrade_link}}"\n           style="display:block;padding:12px 32px;color:#03120f;font-size:14px;font-weight:700;text-decoration:none;font-family:Arial,sans-serif">\n          Upgrade to Premium →\n        </a>\n      </td>\n    </tr>\n  </table>\n</div>\n\n<p style="font-size:13px;color:#64748b">Questions? Just reply to this email.</p>\n\n<p style="margin-top:24px;color:#1a2540">Cheers,<br><strong>Moses &amp; The SC Team</strong></p>`,
  },
  custom: {
    label: '✏️ Custom Broadcast',
    desc: 'Compose from scratch',
    tag: 'BROADCAST',
    subject: '',
    body: `<p style="font-size:17px;margin:0 0 20px">Hello {{name}},</p>\n\n<p style="margin:0 0 16px">Write your message here...</p>\n\n<p style="margin-top:32px;color:#1a2540">Best regards,<br><strong>The SC Team</strong></p>`,
  },
};

// ── Render template list ──────────────────────────────────────────────────────
function renderTemplateList() {
  const el = document.getElementById('template-list');
  if (!el) return;
  el.innerHTML = Object.entries(TEMPLATES).map(([key, t]) => `
    <div onclick="loadTemplate('${key}')"
         id="tpl-btn-${key}"
         style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:10px 12px;cursor:pointer;transition:border-color .15s">
      <div style="font-size:13px;font-weight:600;color:var(--text)">${t.label}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:2px">${t.desc}</div>
      <div style="display:inline-block;margin-top:5px;font:700 9px var(--mono);padding:2px 7px;border-radius:14px;background:var(--bg3);color:var(--text3);border:1px solid var(--border)">${t.tag}</div>
    </div>`).join('');
}

let activeTemplate = 'welcome';
function loadTemplate(key) {
  activeTemplate = key;
  const t = TEMPLATES[key];
  if (!t) return;
  document.querySelectorAll('#template-list > div').forEach(d => {
    d.style.borderColor = 'var(--border)';
    d.style.background  = 'var(--card)';
  });
  const btn = document.getElementById(`tpl-btn-${key}`);
  if (btn) { btn.style.borderColor = 'var(--accent)'; btn.style.background = 'rgba(0,212,170,.07)'; }
  document.getElementById('email-subject').value = t.subject;
  document.getElementById('email-body').value    = t.body;
  document.getElementById('email-preview-box').style.display = 'none';
  updateRecipientCountLabel();
}

function insertToken(token) {
  const ta = document.getElementById('email-body');
  if (!ta) return;
  const s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
  ta.value = v.slice(0, s) + token + v.slice(e);
  ta.selectionStart = ta.selectionEnd = s + token.length;
  ta.focus();
}

function onTargetChange() {
  const t = document.getElementById('email-target').value;
  document.getElementById('single-email-wrap').style.display = t === 'single' ? 'block' : 'none';
  updateRecipientCountLabel();
}

function updateRecipientCountLabel() {
  const target = document.getElementById('email-target')?.value;
  const a = state.analytics;
  let count = '—';
  if (a) {
    if (target === 'all')     count = Number(a.total_users   || 0);
    if (target === 'premium') count = Number(a.premium_users || 0);
    if (target === 'free')    count = Number(a.free_users    || 0);
    if (target === 'single')  count = 1;
  }
  setText('recipient-count-label', `to ${count} recipient${count === 1 ? '' : 's'}`);
}

function previewEmail() {
  const subject = document.getElementById('email-subject').value;
  const body    = document.getElementById('email-body').value;
  const sample  = { name: 'John Kamau', email: 'john@example.com', plan: 'Premium', premium_expires_at: new Date(Date.now() + 30*86400000).toISOString() };
  const expiry  = new Date(sample.premium_expires_at).toLocaleDateString('en-KE', { year:'numeric', month:'long', day:'numeric' });
  const pSubj   = subject.replace(/\{\{name\}\}/g, sample.name).replace(/\{\{email\}\}/g, sample.email).replace(/\{\{plan\}\}/g, sample.plan).replace(/\{\{expires\}\}/g, expiry).replace(/\{\{upgrade_link\}\}/g, 'https://salarycalculator.co.ke/#pricing');
  const pBody   = body.replace(/\{\{name\}\}/g, sample.name).replace(/\{\{email\}\}/g, sample.email).replace(/\{\{plan\}\}/g, sample.plan).replace(/\{\{expires\}\}/g, expiry).replace(/\{\{upgrade_link\}\}/g, 'https://salarycalculator.co.ke/#pricing').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  setText('preview-subject', pSubj || '(no subject)');
  setText('preview-body', pBody.slice(0, 400) + (pBody.length > 400 ? '...' : ''));
  document.getElementById('email-preview-box').style.display = 'block';
}

async function sendEmail() {
  const target  = document.getElementById('email-target').value;
  const subject = document.getElementById('email-subject').value.trim();
  const body    = document.getElementById('email-body').value.trim();

  if (!subject) return showToast('Subject is required', 'error');
  if (!body)    return showToast('Message body is required', 'error');
  if (target === 'single' && !document.getElementById('single-email-input').value.trim()) {
    return showToast('Enter the user email', 'error');
  }

  setBtnLoading('send-email-btn', true, '⏳ Sending...');

  const { data: { session } } = await sb.auth.getSession();
  if (!session) { setBtnLoading('send-email-btn', false); return showToast('Session expired', 'error'); }

  let resp, result;
  try {
    resp = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        template_key: activeTemplate,
        subject,
        html_body: body,
        target,
        single_email: target === 'single' ? document.getElementById('single-email-input').value.trim() : null,
      }),
    });
    result = await resp.json();
  } catch (e) {
    setBtnLoading('send-email-btn', false);
    return showToast('Network error: ' + e.message, 'error');
  }

  setBtnLoading('send-email-btn', false);

  if (!resp.ok || result.error) {
    return showToast('Send error: ' + (result.error || resp.status), 'error');
  }

  showToast(`✉️ Sent to ${result.sent} recipient${result.sent === 1 ? '' : 's'}${result.failed ? ` · ${result.failed} failed` : ''}`);
  addSendLogEntry({ subject, sent: result.sent, target, template: activeTemplate });
}

function addSendLogEntry({ subject, sent, target, template }) {
  const log = document.getElementById('send-log');
  if (!log) return;
  if (log.querySelector('[style*="color:var(--text3)"]')) log.innerHTML = '';
  const icons = { all:'📋', premium:'⭐', free:'🆓', single:'👤' };
  const entry = document.createElement('div');
  entry.style.cssText = 'background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px 10px';
  entry.innerHTML = `
    <div style="font-size:12px;font-weight:600;color:var(--text)">${icons[target]||'✉️'} ${esc(subject.slice(0,40))}${subject.length>40?'…':''}</div>
    <div style="display:flex;justify-content:space-between;margin-top:3px">
      <span style="font:11px var(--mono);color:var(--text3)">${new Date().toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'})}</span>
      <span style="font:700 11px var(--mono);color:var(--accent)">${sent} sent</span>
    </div>`;
  log.insertBefore(entry, log.firstChild);
}

// Call on Email Center section load
function initEmailCenter() {
  renderTemplateList();
  loadTemplate('welcome');
  updateRecipientCountLabel();
}
```

Also update `showSection()` to call `initEmailCenter()` when email section opens:

```javascript
// In showSection(), add this case:
function showSection(id, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(`section-${id}`)?.classList.add('active');
  document.querySelectorAll('.nav button[data-section]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const titles = { overview: 'Overview', users: 'Users', revenue: 'Revenue', email: 'Email Center' };
  setText('topbar-title', titles[id] || 'Overview');
  if (id === 'email') initEmailCenter();  // ← add this line
}
```

---

## PART 6 — `vercel.json` UPDATE

Add the send-email route to your existing `rewrites` array:

```json
{ "source": "/api/send-email", "destination": "/api/send-email.js" }
```

---

## PART 7 — DEPLOYMENT CHECKLIST

Run in this order:

```bash
# 1. Install Nodemailer
npm install nodemailer

# 2. Verify file exists
ls api/send-email.js   # should exist

# 3. Set Vercel env vars (Dashboard → Settings → Environment Variables):
#    GMAIL_USER              = admin@salarycalculator.co.ke
#    GMAIL_APP_PASSWORD      = (16-char app password from Google)
#    GMAIL_FROM_NAME         = Salary Calculator Kenya

# 4. Push to GitHub → Vercel deploys automatically

# 5. Test: run this SQL to check email_send_log table exists
#    SELECT * FROM email_send_log LIMIT 1;

# 6. Test send from admin.html:
#    a. Go to Email Center → select "Welcome Email"
#    b. Target: Specific User → enter your own email
#    c. Click Preview → confirm personalisation looks right
#    d. Click Send Email
#    e. Check your inbox → confirm email arrives with header + footer
#    f. Check Supabase → email_send_log → confirm row was created
```

---

## GMAIL SENDING LIMITS (Google Workspace Business Standard)

| Limit | Value |
|-------|-------|
| Daily sending limit | 2,000 emails/day |
| Per-minute rate | ~100 emails/min (our throttle: ~6/min for safety) |
| Attachment size | 25 MB |
| Recipients per message | 1 (we send individually for personalisation) |
| SMTP connections | Up to 20 concurrent |

For lists larger than 500 users, consider splitting into batches across multiple days or
upgrading to Google Workspace's **Gmail API** with OAuth2 for higher throughput.

---

*salarycalculator.co.ke · Moses W. Mwombe · MonarCat · Nairobi, Kenya*
*Stack: Vercel · Supabase · Google Workspace SMTP · Nodemailer · Chart.js*
