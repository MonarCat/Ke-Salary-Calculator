import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': 'https://salarycalculator.co.ke',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const SUPA_URL = 'https://wznopthjoaqusalqoyru.supabase.co';
const SVC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'kesalarycalculator@gmail.com')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function createTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    pool: true,
    maxConnections: 3,
    rateDelta: 1000,
    rateLimit: 10,
  });
}

function getName(user) {
  const emailPrefix = String(user?.email || 'there').split('@')[0];
  return String(user?.full_name || user?.display_name || user?.name || emailPrefix).trim();
}

function personalise(text, user) {
  const expiry = user.premium_expires_at
    ? new Date(user.premium_expires_at).toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'N/A';
  const isPremium = user.premium_expires_at && new Date(user.premium_expires_at) > new Date();
  const plan = isPremium ? 'Premium' : 'Free';

  return String(text || '')
    .replace(/\{\{name\}\}/g, user.name || getName(user) || 'there')
    .replace(/\{\{email\}\}/g, user.email || '')
    .replace(/\{\{plan\}\}/g, plan)
    .replace(/\{\{expires\}\}/g, expiry)
    .replace(/\{\{upgrade_link\}\}/g, 'https://salarycalculator.co.ke/#pricing');
}

function wrapInEmailShell(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Salary Calculator Kenya</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Georgia,'Times New Roman',serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
      <tr><td style="background:#060b18;border-radius:12px 12px 0 0;padding:28px 40px;text-align:center">
        <div style="font-family:Arial,sans-serif;font-size:22px;font-weight:900;color:#00d4aa;letter-spacing:-0.5px">⚡ Salary Calculator Kenya</div>
        <div style="font-size:12px;color:#4f6280;margin-top:4px;font-family:Arial,sans-serif;letter-spacing:2px">SALARYCALCULATOR.CO.KE</div>
      </td></tr>
      <tr><td style="background:#ffffff;padding:40px;font-size:15px;line-height:1.8;color:#1a2540">${bodyHtml}</td></tr>
      ${EMAIL_FOOTER}
    </table>
  </td></tr>
</table>
</body></html>`;
}

const EMAIL_FOOTER = `
<tr><td style="background:#f4f6f9;border-top:2px solid #e2e8f0;border-radius:0 0 12px 12px;padding:28px 40px">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="text-align:center;padding-bottom:16px">
      <div style="font-family:Arial,sans-serif;font-size:13px;font-weight:700;color:#00d4aa">⚡ Salary Calculator Kenya</div>
      <div style="font-size:11px;color:#8fa3c8;margin-top:3px;font-family:Arial,sans-serif">Kenya's most accurate payslip calculator · Powered by MonarCat</div>
    </td></tr>
    <tr><td style="background:#eef9f6;border:1px solid #c3ede6;border-radius:8px;padding:10px 16px;text-align:center">
      <div style="font-size:11px;color:#006b54;font-family:Arial,sans-serif;line-height:1.6"><strong>FY 2025/2026 Tax Rates Active</strong><br>PAYE (up to 35%) · NSSF Tier I &amp; II · SHIF 2.75% · Housing Levy 1.5%<br>Personal Relief: KES 2,400/month</div>
    </td></tr>
    <tr><td style="padding:12px 0"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #e2e8f0"></td></tr></table></td></tr>
    <tr><td style="text-align:center;padding-bottom:12px">
      <a href="https://salarycalculator.co.ke/calculator.html" style="font-size:12px;color:#00a88a;text-decoration:none;font-family:Arial,sans-serif;margin:0 8px">Calculator</a>
      <span style="color:#cbd5e1;font-size:12px">|</span>
      <a href="https://salarycalculator.co.ke/blog.html" style="font-size:12px;color:#00a88a;text-decoration:none;font-family:Arial,sans-serif;margin:0 8px">Blog</a>
      <span style="color:#cbd5e1;font-size:12px">|</span>
      <a href="https://salarycalculator.co.ke/account.html" style="font-size:12px;color:#00a88a;text-decoration:none;font-family:Arial,sans-serif;margin:0 8px">My Account</a>
      <span style="color:#cbd5e1;font-size:12px">|</span>
      <a href="https://salarycalculator.co.ke/contact-us.html" style="font-size:12px;color:#00a88a;text-decoration:none;font-family:Arial,sans-serif;margin:0 8px">Contact Us</a>
    </td></tr>
    <tr><td style="text-align:center">
      <div style="font-size:11px;color:#94a3b8;font-family:Arial,sans-serif;line-height:1.7">
        &copy; 2025 Salary Calculator Kenya &mdash; A MonarCat Product<br>
        Nairobi, Kenya &nbsp;&middot;&nbsp; Registered in Kenya<br><br>
        You are receiving this email because you have an account at salarycalculator.co.ke.<br>
        <a href="https://salarycalculator.co.ke/account.html?unsubscribe=1" style="color:#94a3b8;text-decoration:underline">Unsubscribe</a>
        &nbsp;&middot;&nbsp;
        <a href="https://salarycalculator.co.ke/privacy-policy.html" style="color:#94a3b8;text-decoration:underline">Privacy Policy</a>
        &nbsp;&middot;&nbsp;
        <a href="https://salarycalculator.co.ke/terms-of-service.html" style="color:#94a3b8;text-decoration:underline">Terms of Use</a>
      </div>
    </td></tr>
  </table>
</td></tr>`;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!SVC_KEY || !ANON_KEY || !process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return res.status(500).json({ error: 'Missing server env configuration' });
  }

  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'No token' });

  const callerSb = createClient(SUPA_URL, ANON_KEY);
  const {
    data: { user: caller },
  } = await callerSb.auth.getUser(token);
  if (!caller || !ADMIN_EMAILS.includes(caller.email?.toLowerCase())) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const admin = createClient(SUPA_URL, SVC_KEY);
  const { template_key, subject, html_body, text_body, target, single_email } = req.body || {};
  if (!subject || !html_body) {
    return res.status(400).json({ error: 'subject and html_body are required' });
  }

  let recipients = [];
  if (target === 'single') {
    const recipientEmail = String(single_email || '').trim().toLowerCase();
    if (!recipientEmail) return res.status(400).json({ error: 'single_email required' });
    const { data } = await admin.from('user_profiles').select('*').eq('email', recipientEmail).maybeSingle();
    const base = data || { email: recipientEmail };
    recipients = [{ ...base, email: recipientEmail, name: getName(base) }];
  } else {
    let query = admin.from('user_profiles').select('*');
    const nowIso = new Date().toISOString();
    if (target === 'premium') {
      query = query.gt('premium_expires_at', nowIso);
    } else if (target === 'free') {
      query = query.or(`premium_expires_at.is.null,premium_expires_at.lte.${nowIso}`);
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    recipients = (data || [])
      .filter((u) => !!u.email)
      .map((u) => ({
        ...u,
        name: getName(u),
      }));
  }

  if (!recipients.length) {
    return res.json({ success: true, sent: 0, failed: 0, total: 0, message: 'No recipients in that segment' });
  }

  const transporter = createTransporter();
  const FROM = `"${process.env.GMAIL_FROM_NAME || 'Salary Calculator Kenya'}" <${process.env.GMAIL_USER}>`;
  let sent = 0;
  let failed = 0;
  const errors = [];

  for (const r of recipients) {
    const personalHtml = personalise(html_body, r);
    const personalText = text_body ? personalise(text_body, r) : undefined;
    const personalSubj = personalise(subject, r);

    try {
      const mailOptions = {
        from: FROM,
        to: r.email,
        subject: personalSubj,
        html: wrapInEmailShell(personalHtml),
        headers: {
          'List-Unsubscribe': '<https://salarycalculator.co.ke/account.html?unsubscribe=1>',
          'X-Mailer': 'SC Admin Dashboard',
        },
      };
      if (personalText) mailOptions.text = personalText;
      await transporter.sendMail(mailOptions);
      sent++;
    } catch (e) {
      failed++;
      errors.push(`${r.email}: ${e.message}`);
      console.error('[send-email] Failed to send to', r.email, e.message);
    }

    if (recipients.length > 1) await delay(150);
  }

  transporter.close();

  await admin
    .from('email_send_log')
    .insert({
      admin_email: caller.email,
      template_key: template_key || 'custom',
      subject,
      target_segment: target || 'all',
      recipient_count: sent,
      // Keep audit rows compact while retaining enough traceability for bulk sends.
      recipients: recipients.slice(0, 100).map((r) => r.email),
      status: failed === 0 ? 'sent' : sent === 0 ? 'failed' : 'partial',
      error_message: errors.length ? errors.slice(0, 5).join('; ') : null,
    })
    .catch((e) => console.error('[send-email] Log error:', e.message));

  return res.json({
    success: true,
    sent,
    failed,
    total: recipients.length,
    errors: errors.slice(0, 3),
  });
}
