/**
 * api/daily-cron.js
 *
 * Merged from api/email-automation-cron.js + api/referral-qualification-cron.js.
 * Vercel's Hobby plan caps a deployment at 12 serverless functions; adding
 * both as separate scheduled jobs pushed this project to 13 and broke
 * every deployment outright. Both were already daily, CRON_SECRET-gated,
 * "read account state and act" jobs -- consolidating them into one
 * invocation that runs both in sequence is the natural fix, not a
 * workaround: same trigger, same auth check, no reason they needed
 * separate routes or separate cron entries.
 *
 * All original behavior is preserved exactly; only the entry point and
 * the (now-shared, previously duplicated) CRON_SECRET check changed.
 * See git history for the two original files' full standalone headers
 * if you need the complete original context.
 *
 * -- Part 1: Email automation (formerly email-automation-cron.js) --
 * Sends the lifecycle emails: welcome, premium_activated,
 * premium_expiring_3d, premium_expired, premium_offer_2d. Deliberately
 * does NOT hook into api/paystack-webhook.js (protected file) -- reads
 * user_profiles state directly instead. Idempotent via
 * email_automation_log with a claim-then-send pattern.
 *
 * -- Part 2: Referral qualification (formerly referral-qualification-cron.js) --
 * Checks every pending referral, marks it qualified once eligible, and
 * credits the referrer with premium days:
 *   - 3 qualified FREE referrals   -> +30 days (1 month), batched
 *   - 1 qualified MONTHLY referral -> +30 days (1 month), immediate
 *   - 1 qualified YEARLY referral  -> +120 days (4 months), immediate
 * Reads (never writes to) the existing "payments" table to distinguish
 * monthly vs yearly -- never touches any protected Paystack file.
 * Milestone bonuses stack on top: 5/10/15/25/50/100+ cumulative
 * referrals, tracked in referral_stats.milestones_claimed so a
 * milestone is never paid out twice. "Lifetime premium" (100+) is
 * premium_expires_at set to 2099, since plan-features.js (protected)
 * already just checks premium_expires_at > now().
 *
 * Required Vercel env vars: CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY,
 * BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME
 */

import { createClient } from '@supabase/supabase-js';
import { wrapInEmailShell, sendViaBrevo, getName } from './_lib/mailer.js';

const SUPA_URL = process.env.SUPABASE_URL || 'https://wznopthjoaqusalqoyru.supabase.co';
const SVC_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE = 'https://salarycalculator.co.ke';

// ============================================================================
// PART 1: EMAIL AUTOMATION
// ============================================================================

function welcomeEmail(user) {
  const name = getName(user);
  return {
    subject: `Welcome to Salary Calculator Kenya, ${name}!`,
    html: wrapInEmailShell(`
      <p style="margin:0 0 16px">Hi ${name},</p>
      <p style="margin:0 0 16px">Thanks for creating an account at Salary Calculator Kenya. You can now:</p>
      <ul style="margin:0 0 16px;padding-left:20px">
        <li>Get a full PAYE, NSSF, SHIF and Housing Levy breakdown of your salary</li>
        <li>Generate professional payslips</li>
        <li>Track payroll history and manage employees</li>
      </ul>
      <p style="margin:0 0 24px">
        <a href="${SITE}/calculator.html" style="background:#1a6b3c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Start Calculating</a>
      </p>
      <p style="margin:0;color:#667085">If you didn't create this account, you can safely ignore this email.</p>
    `, { heading: 'Welcome!' }),
  };
}

function premiumActivatedEmail(user) {
  const name = getName(user);
  const expiry = user.premium_expires_at
    ? new Date(user.premium_expires_at).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'N/A';
  return {
    subject: 'Your Premium subscription is active 🎉',
    html: wrapInEmailShell(`
      <p style="margin:0 0 16px">Hi ${name},</p>
      <p style="margin:0 0 16px">Your Premium subscription is now active. Thank you for supporting Salary Calculator Kenya!</p>
      <p style="margin:0 0 16px"><strong>Valid until:</strong> ${expiry}</p>
      <p style="margin:0 0 24px">
        <a href="${SITE}/account.html" style="background:#1a6b3c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">View Your Account</a>
      </p>
    `, { heading: 'Premium Activated' }),
  };
}

function premiumExpiringEmail(user) {
  const name = getName(user);
  const expiry = new Date(user.premium_expires_at).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });
  return {
    subject: 'Your Premium subscription expires in 3 days',
    html: wrapInEmailShell(`
      <p style="margin:0 0 16px">Hi ${name},</p>
      <p style="margin:0 0 16px">Your Premium subscription is set to expire on <strong>${expiry}</strong>.</p>
      <p style="margin:0 0 24px">Renew now to keep uninterrupted access to payslip generation, payroll history, and employee management.</p>
      <p style="margin:0 0 24px">
        <a href="${SITE}/account.html#pricing" style="background:#1a6b3c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Renew Premium</a>
      </p>
    `, { heading: 'Premium Expiring Soon' }),
  };
}

function premiumExpiredEmail(user) {
  const name = getName(user);
  return {
    subject: 'Your Premium subscription has expired',
    html: wrapInEmailShell(`
      <p style="margin:0 0 16px">Hi ${name},</p>
      <p style="margin:0 0 16px">Your Premium subscription has expired. You've been moved to the Free plan, so some features like unlimited payslips and payroll history are now limited.</p>
      <p style="margin:0 0 24px">
        <a href="${SITE}/account.html#pricing" style="background:#1a6b3c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Reactivate Premium</a>
      </p>
    `, { heading: 'Premium Expired' }),
  };
}

function premiumOfferEmail(user) {
  const name = getName(user);
  return {
    subject: 'A closer look at Salary Calculator Premium',
    html: wrapInEmailShell(`
      <p style="margin:0 0 16px">Hi ${name},</p>
      <p style="margin:0 0 16px">You've been using Salary Calculator Kenya for a couple of days now — hope it's been useful! Premium unlocks:</p>
      <ul style="margin:0 0 16px;padding-left:20px">
        <li>Unlimited payslip generation</li>
        <li>Payroll history &amp; reports</li>
        <li>P9A generation</li>
        <li>Employee management</li>
      </ul>
      <p style="margin:0 0 24px">
        <a href="${SITE}/account.html#pricing" style="background:#1a6b3c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">See Premium Plans</a>
      </p>
    `, { heading: 'Get More With Premium' }),
  };
}

async function claimAndSend(admin, user, emailType, referenceValue, buildEmail) {
  const { data: claimed, error: claimErr } = await admin
    .from('email_automation_log')
    .insert({ user_id: user.id, email_type: emailType, reference_value: referenceValue })
    .select('id')
    .maybeSingle();

  if (claimErr) {
    if (claimErr.code === '23505') return 'already_sent';
    console.error(`[daily-cron:email] claim failed for ${emailType}/${user.email}:`, claimErr.message);
    return 'claim_error';
  }
  if (!claimed) return 'already_sent';

  try {
    const { subject, html } = buildEmail(user);
    await sendViaBrevo({ to: user.email, toName: getName(user), subject, htmlContent: html });
    return 'sent';
  } catch (sendErr) {
    console.error(`[daily-cron:email] send failed for ${emailType}/${user.email}:`, sendErr.message);
    return 'send_error';
  }
}

async function runSegment(admin, users, emailType, referenceOf, buildEmail) {
  const counts = { sent: 0, already_sent: 0, claim_error: 0, send_error: 0 };
  for (const user of users) {
    if (!user.email) continue;
    const result = await claimAndSend(admin, user, emailType, referenceOf(user), buildEmail);
    counts[result] = (counts[result] || 0) + 1;
  }
  return counts;
}

async function runEmailAutomation(admin, now) {
  const results = {};

  {
    const since = new Date(now - 3 * 24 * 3600 * 1000).toISOString();
    const { data, error } = await admin
      .from('user_profiles')
      .select('id, email, full_name, created_at')
      .gte('created_at', since)
      .eq('is_banned', false);
    if (error) console.error('[daily-cron:email] welcome query error:', error.message);
    results.welcome = await runSegment(admin, data || [], 'welcome', () => '', welcomeEmail);
  }

  {
    const { data, error } = await admin
      .from('user_profiles')
      .select('id, email, full_name, premium_expires_at')
      .eq('premium', true)
      .not('premium_expires_at', 'is', null)
      .gt('premium_expires_at', now.toISOString())
      .eq('is_banned', false);
    if (error) console.error('[daily-cron:email] premium_activated query error:', error.message);
    results.premium_activated = await runSegment(
      admin, data || [], 'premium_activated',
      (u) => u.premium_expires_at, premiumActivatedEmail
    );
  }

  {
    const from = new Date(now.getTime() + 2.5 * 24 * 3600 * 1000).toISOString();
    const to   = new Date(now.getTime() + 3.5 * 24 * 3600 * 1000).toISOString();
    const { data, error } = await admin
      .from('user_profiles')
      .select('id, email, full_name, premium_expires_at')
      .eq('premium', true)
      .gte('premium_expires_at', from)
      .lte('premium_expires_at', to)
      .eq('is_banned', false);
    if (error) console.error('[daily-cron:email] premium_expiring_3d query error:', error.message);
    results.premium_expiring_3d = await runSegment(
      admin, data || [], 'premium_expiring_3d',
      (u) => u.premium_expires_at, premiumExpiringEmail
    );
  }

  {
    const from = new Date(now.getTime() - 25 * 3600 * 1000).toISOString();
    const { data, error } = await admin
      .from('user_profiles')
      .select('id, email, full_name, premium_expires_at')
      .not('premium_expires_at', 'is', null)
      .gte('premium_expires_at', from)
      .lte('premium_expires_at', now.toISOString())
      .eq('is_banned', false);
    if (error) console.error('[daily-cron:email] premium_expired query error:', error.message);
    results.premium_expired = await runSegment(
      admin, data || [], 'premium_expired',
      (u) => u.premium_expires_at, premiumExpiredEmail
    );
  }

  {
    const from = new Date(now.getTime() - 52 * 3600 * 1000).toISOString();
    const to   = new Date(now.getTime() - 44 * 3600 * 1000).toISOString();
    const { data, error } = await admin
      .from('user_profiles')
      .select('id, email, full_name, created_at')
      .eq('premium', false)
      .gte('created_at', from)
      .lte('created_at', to)
      .eq('is_banned', false);
    if (error) console.error('[daily-cron:email] premium_offer_2d query error:', error.message);
    results.premium_offer_2d = await runSegment(
      admin, data || [], 'premium_offer_2d',
      () => '', premiumOfferEmail
    );
  }

  return results;
}

// ============================================================================
// PART 2: REFERRAL QUALIFICATION
// ============================================================================

const FREE_GRACE_DAYS = 7;
const FREE_BATCH_SIZE = 3;
const DAYS_PER_FREE_BATCH = 30;
const DAYS_PER_MONTHLY_REFERRAL = 30;
const DAYS_PER_YEARLY_REFERRAL = 120;

const MILESTONES = [
  { threshold: 5,   bonusDays: 15 },
  { threshold: 10,  bonusDays: 30 },
  { threshold: 15,  bonusDays: 45 },
  { threshold: 25,  bonusDays: 90 },
  { threshold: 50,  bonusDays: 180 },
  { threshold: 100, bonusDays: null, lifetime: true },
];

const LIFETIME_EXPIRY_ISO = '2099-12-31T23:59:59+00:00';

function addDaysToExpiry(currentExpiresAt, days) {
  const base = currentExpiresAt && new Date(currentExpiresAt) > new Date() ? new Date(currentExpiresAt) : new Date();
  return new Date(base.getTime() + days * 24 * 3600 * 1000).toISOString();
}

async function creditPremiumDays(admin, userId, days) {
  const { data: profile, error: fetchErr } = await admin
    .from('user_profiles')
    .select('premium_expires_at')
    .eq('id', userId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;

  const newExpiry = addDaysToExpiry(profile?.premium_expires_at, days);
  const { error: updateErr } = await admin
    .from('user_profiles')
    .update({ premium: true, premium_expires_at: newExpiry, premium_source: 'referral' })
    .eq('id', userId);
  if (updateErr) throw updateErr;
}

async function grantLifetimePremium(admin, userId) {
  const { error } = await admin
    .from('user_profiles')
    .update({ premium: true, premium_expires_at: LIFETIME_EXPIRY_ISO, premium_source: 'referral' })
    .eq('id', userId);
  if (error) throw error;
}

async function upsertReferralStats(admin, userId, { addQualified = 0, addDays = 0 }) {
  const { data: existing, error: fetchErr } = await admin
    .from('referral_stats')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;

  if (!existing) {
    const { error } = await admin.from('referral_stats').insert({
      user_id: userId,
      total_qualified_referrals: addQualified,
      total_premium_days_earned: addDays,
    });
    if (error) throw error;
    return { total_qualified_referrals: addQualified, milestones_claimed: [] };
  }

  const { error } = await admin
    .from('referral_stats')
    .update({
      total_qualified_referrals: existing.total_qualified_referrals + addQualified,
      total_premium_days_earned: existing.total_premium_days_earned + addDays,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  if (error) throw error;

  return {
    total_qualified_referrals: existing.total_qualified_referrals + addQualified,
    milestones_claimed: existing.milestones_claimed || [],
  };
}

async function checkAndApplyMilestones(admin, userId, totalQualified, milestonesClaimed) {
  const newlyClaimed = [];
  for (const m of MILESTONES) {
    if (totalQualified >= m.threshold && !milestonesClaimed.includes(m.threshold)) {
      if (m.lifetime) {
        await grantLifetimePremium(admin, userId);
        await admin.from('referral_stats').update({ is_lifetime_premium: true }).eq('user_id', userId);
      } else {
        await creditPremiumDays(admin, userId, m.bonusDays);
        await upsertReferralStats(admin, userId, { addDays: m.bonusDays });
      }
      newlyClaimed.push(m.threshold);
    }
  }
  if (newlyClaimed.length) {
    const allClaimed = [...new Set([...milestonesClaimed, ...newlyClaimed])];
    await admin.from('referral_stats').update({ milestones_claimed: allClaimed }).eq('user_id', userId);
  }
  return newlyClaimed;
}

async function runReferralQualification(admin, now) {
  const results = { qualified_free: 0, qualified_monthly: 0, qualified_yearly: 0, free_batches_credited: 0, milestones_applied: 0, errors: [] };

  const { data: pending, error: pendingErr } = await admin
    .from('referrals')
    .select('id, referrer_id, referred_user_id, referred_signed_up_at, status')
    .eq('status', 'pending');
  if (pendingErr) {
    results.errors.push({ stage: 'fetch_pending', error: pendingErr.message });
    return results;
  }

  for (const ref of pending || []) {
    try {
      const { data: referredProfile } = await admin
        .from('user_profiles')
        .select('is_banned')
        .eq('id', ref.referred_user_id)
        .maybeSingle();

      if (referredProfile?.is_banned) {
        await admin.from('referrals').update({ status: 'disqualified' }).eq('id', ref.id);
        continue;
      }

      const { data: payment } = await admin
        .from('payments')
        .select('plan, verified_at')
        .eq('user_id', ref.referred_user_id)
        .not('verified_at', 'is', null)
        .order('verified_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (payment?.plan === 'yearly') {
        await admin.from('referrals').update({ status: 'qualified_yearly', credited_days: DAYS_PER_YEARLY_REFERRAL, qualified_at: now.toISOString() }).eq('id', ref.id);
        await creditPremiumDays(admin, ref.referrer_id, DAYS_PER_YEARLY_REFERRAL);
        await upsertReferralStats(admin, ref.referrer_id, { addQualified: 1, addDays: DAYS_PER_YEARLY_REFERRAL });
        results.qualified_yearly++;
        continue;
      }
      if (payment?.plan === 'monthly') {
        await admin.from('referrals').update({ status: 'qualified_monthly', credited_days: DAYS_PER_MONTHLY_REFERRAL, qualified_at: now.toISOString() }).eq('id', ref.id);
        await creditPremiumDays(admin, ref.referrer_id, DAYS_PER_MONTHLY_REFERRAL);
        await upsertReferralStats(admin, ref.referrer_id, { addQualified: 1, addDays: DAYS_PER_MONTHLY_REFERRAL });
        results.qualified_monthly++;
        continue;
      }

      const signedUpAt = new Date(ref.referred_signed_up_at);
      const daysSinceSignup = (now - signedUpAt) / (24 * 3600 * 1000);
      if (daysSinceSignup >= FREE_GRACE_DAYS) {
        await admin.from('referrals').update({ status: 'qualified_free', qualified_at: now.toISOString() }).eq('id', ref.id);
        results.qualified_free++;
      }
    } catch (err) {
      console.error('[daily-cron:referral] error processing referral', ref.id, err.message);
      results.errors.push({ referral_id: ref.id, error: err.message });
    }
  }

  const { data: uncreditedFree, error: freeErr } = await admin
    .from('referrals')
    .select('id, referrer_id')
    .eq('status', 'qualified_free')
    .eq('batch_credited', false);
  if (freeErr) {
    results.errors.push({ stage: 'fetch_uncredited_free', error: freeErr.message });
    return results;
  }

  const byReferrer = new Map();
  for (const r of uncreditedFree || []) {
    if (!byReferrer.has(r.referrer_id)) byReferrer.set(r.referrer_id, []);
    byReferrer.get(r.referrer_id).push(r.id);
  }

  for (const [referrerId, referralIds] of byReferrer.entries()) {
    try {
      const completeBatches = Math.floor(referralIds.length / FREE_BATCH_SIZE);
      if (completeBatches <= 0) continue;

      const idsToCredit = referralIds.slice(0, completeBatches * FREE_BATCH_SIZE);
      const totalDays = completeBatches * DAYS_PER_FREE_BATCH;

      await admin.from('referrals').update({ batch_credited: true }).in('id', idsToCredit);
      await creditPremiumDays(admin, referrerId, totalDays);
      await upsertReferralStats(admin, referrerId, { addQualified: idsToCredit.length, addDays: totalDays });
      results.free_batches_credited += completeBatches;
    } catch (err) {
      console.error('[daily-cron:referral] error batch-crediting referrer', referrerId, err.message);
      results.errors.push({ referrer_id: referrerId, error: err.message });
    }
  }

  const { data: statsRows, error: statsErr } = await admin
    .from('referral_stats')
    .select('user_id, total_qualified_referrals, milestones_claimed');
  if (statsErr) {
    results.errors.push({ stage: 'fetch_stats', error: statsErr.message });
    return results;
  }

  for (const row of statsRows || []) {
    try {
      const newlyClaimed = await checkAndApplyMilestones(admin, row.user_id, row.total_qualified_referrals, row.milestones_claimed || []);
      results.milestones_applied += newlyClaimed.length;
    } catch (err) {
      console.error('[daily-cron:referral] error applying milestones for', row.user_id, err.message);
      results.errors.push({ user_id: row.user_id, error: err.message });
    }
  }

  return results;
}

// ============================================================================
// HANDLER
// ============================================================================

export default async function handler(req, res) {
  try {
    return await run(req, res);
  } catch (fatalErr) {
    console.error('[daily-cron] Unhandled error:', fatalErr);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Unexpected server error: ' + (fatalErr?.message || String(fatalErr)) });
    }
  }
}

async function run(req, res) {
  const expected = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization || '';
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SVC_KEY) {
    return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' });
  }

  const admin = createClient(SUPA_URL, SVC_KEY);
  const now = new Date();

  const email_automation = await runEmailAutomation(admin, now);
  const referral_qualification = await runReferralQualification(admin, now);

  return res.status(200).json({
    success: true,
    ran_at: now.toISOString(),
    email_automation,
    referral_qualification,
  });
}
