/**
 * api/feedback-form.js
 *
 * Public endpoint (no auth) backing the feedback/comments/inquiries/
 * suggestions form on contact-us.html. Stores the submission in
 * feedback_submissions and emails it to the admin inbox via Brevo.
 *
 * Required Vercel env vars (BREVO_* already exist for send-email.js):
 *   SUPABASE_SERVICE_ROLE_KEY
 *   FEEDBACK_RECIPIENT_EMAIL   -- optional, defaults to adminkesalo@gmail.com
 */

import { createClient } from '@supabase/supabase-js';
import { wrapInEmailShell, sendViaBrevo } from './_lib/mailer.js';

const SUPA_URL = process.env.SUPABASE_URL || 'https://wznopthjoaqusalqoyru.supabase.co';
const SVC_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RECIPIENT = process.env.FEEDBACK_RECIPIENT_EMAIL || 'adminkesalo@gmail.com';

const ALLOWED_ORIGINS = new Set([
  'https://salarycalculator.co.ke',
  'https://www.salarycalculator.co.ke',
]);

const VALID_CATEGORIES = new Set(['feedback', 'comment', 'inquiry', 'suggestion', 'bug_report', 'other']);

// Simple in-memory rate limit -- resets on cold start, which is fine here:
// its purpose is only to blunt rapid automated spam bursts within one warm
// function instance, not to be a durable global limiter.
const recentSubmissions = new Map(); // ip -> timestamp[]
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX = 5;

function setCors(req, res) {
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.has(origin) ? origin : 'https://salarycalculator.co.ke');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = (recentSubmissions.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  recentSubmissions.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT_MAX;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const CATEGORY_LABELS = {
  feedback: 'Feedback',
  comment: 'Comment',
  inquiry: 'Inquiry',
  suggestion: 'Suggestion',
  bug_report: 'Bug Report',
  other: 'Other',
};

export default async function handler(req, res) {
  try {
    return await run(req, res);
  } catch (fatalErr) {
    console.error('[feedback-form] Unhandled error:', fatalErr);
    if (!res.headersSent) {
      setCors(req, res);
      return res.status(500).json({ error: 'Unexpected server error' });
    }
  }
}

async function run(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!SVC_KEY) return res.status(500).json({ error: 'Server misconfiguration' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many submissions. Please try again later.' });
  }

  const { name, email, category, message, website } = req.body || {};

  // Honeypot: a real user never fills a hidden field named "website".
  if (website) {
    return res.status(200).json({ success: true }); // pretend success, drop silently
  }

  const cleanName    = String(name || '').trim().slice(0, 200);
  const cleanEmail   = String(email || '').trim().slice(0, 320).toLowerCase();
  const cleanCategory = VALID_CATEGORIES.has(category) ? category : 'other';
  const cleanMessage = String(message || '').trim().slice(0, 5000);

  if (!cleanName || !cleanEmail || !cleanMessage) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(cleanEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const admin = createClient(SUPA_URL, SVC_KEY);

  const { error: insertErr } = await admin.from('feedback_submissions').insert({
    name: cleanName,
    email: cleanEmail,
    category: cleanCategory,
    message: cleanMessage,
    ip_address: ip,
    user_agent: String(req.headers['user-agent'] || '').slice(0, 500),
  });
  if (insertErr) {
    console.error('[feedback-form] insert error:', insertErr.message);
    // Continue anyway -- still try to deliver the email even if the DB
    // record fails, so the admin doesn't lose the message entirely.
  }

  const categoryLabel = CATEGORY_LABELS[cleanCategory];

  try {
    await sendViaBrevo({
      to: RECIPIENT,
      toName: 'Salary Calculator Admin',
      subject: `[${categoryLabel}] New message from ${cleanName}`,
      htmlContent: wrapInEmailShell(`
        <p style="margin:0 0 12px"><strong>Category:</strong> ${escapeHtml(categoryLabel)}</p>
        <p style="margin:0 0 12px"><strong>From:</strong> ${escapeHtml(cleanName)} &lt;${escapeHtml(cleanEmail)}&gt;</p>
        <p style="margin:0 0 20px"><strong>Message:</strong></p>
        <p style="margin:0 0 20px;white-space:pre-wrap;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:16px">${escapeHtml(cleanMessage)}</p>
        <p style="margin:0;color:#667085;font-size:13px">Submitted via the contact form at salarycalculator.co.ke</p>
      `, { heading: 'New Contact Form Submission' }),
      replyTo: cleanEmail,
    });
  } catch (mailErr) {
    console.error('[feedback-form] admin notification send failed:', mailErr.message);
    // The submission is already recorded in feedback_submissions above, so
    // this isn't a total loss -- but the client should know delivery was
    // not guaranteed.
    return res.status(200).json({
      success: true,
      warning: 'Your message was recorded but the email notification could not be sent immediately.',
    });
  }

  // Best-effort confirmation to the submitter -- failure here shouldn't
  // fail the whole request, the admin copy above already succeeded.
  sendViaBrevo({
    to: cleanEmail,
    toName: cleanName,
    subject: 'We received your message — Salary Calculator Kenya',
    htmlContent: wrapInEmailShell(`
      <p style="margin:0 0 16px">Hi ${escapeHtml(cleanName)},</p>
      <p style="margin:0 0 16px">Thanks for reaching out. We've received your ${escapeHtml(categoryLabel.toLowerCase())} and will get back to you as soon as we can.</p>
      <p style="margin:0;color:#667085;font-size:13px">This is an automated confirmation -- no need to reply to this email.</p>
    `, { heading: 'Message Received' }),
  }).catch((e) => console.error('[feedback-form] submitter confirmation failed:', e.message));

  return res.status(200).json({ success: true });
}
