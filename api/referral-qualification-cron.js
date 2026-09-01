/**
 * api/referral-qualification-cron.js
 *
 * Scheduled job (see vercel.json "crons") that checks every pending
 * referral, marks it qualified once eligible, and credits the referrer
 * with premium days. Reads (never writes to) the existing "payments"
 * table to distinguish monthly vs yearly subscribers -- never touches
 * any protected Paystack file.
 *
 * Reward rules:
 *   - 3 qualified FREE referrals   -> +30 days (1 month), batched
 *   - 1 qualified MONTHLY referral -> +30 days (1 month), immediate
 *   - 1 qualified YEARLY referral  -> +120 days (4 months), immediate
 *
 * A free referral only qualifies once the referred account is at least
 * FREE_GRACE_DAYS old and not banned -- guards against instant fake-
 * signup farming. Paid referrals qualify as soon as a verified payment
 * exists for that user (no grace period needed -- a real payment already
 * proves the account isn't a throwaway).
 *
 * Milestone bonuses stack on top, based on TOTAL cumulative qualified
 * referrals (any type), tracked in referral_stats.milestones_claimed so
 * a milestone is never paid out twice across cron runs:
 *   5 -> +15 days   10 -> +30 days   15 -> +45 days
 *   25 -> +90 days  50 -> +180 days  100 -> lifetime premium
 *
 * "Lifetime premium" is implemented as premium_expires_at set far in the
 * future (2099) rather than a new premium-status code path, since
 * plan-features.js (which checks premium status) is a protected file
 * this job must not touch or depend on being changed.
 *
 * Required Vercel env vars (already exist for email-automation-cron.js):
 *   CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

const SUPA_URL = process.env.SUPABASE_URL || 'https://wznopthjoaqusalqoyru.supabase.co';
const SVC_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

export default async function handler(req, res) {
  try {
    return await run(req, res);
  } catch (fatalErr) {
    console.error('[referral-qualification-cron] Unhandled error:', fatalErr);
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
  const results = { qualified_free: 0, qualified_monthly: 0, qualified_yearly: 0, free_batches_credited: 0, milestones_applied: 0, errors: [] };

  const { data: pending, error: pendingErr } = await admin
    .from('referrals')
    .select('id, referrer_id, referred_user_id, referred_signed_up_at, status')
    .eq('status', 'pending');
  if (pendingErr) return res.status(500).json({ error: pendingErr.message });

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

      // Check for a verified paid subscription first -- paid referrals
      // qualify immediately, no grace period needed.
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

      // No payment -- eligible for free-tier qualification once the
      // grace period has passed.
      const signedUpAt = new Date(ref.referred_signed_up_at);
      const daysSinceSignup = (now - signedUpAt) / (24 * 3600 * 1000);
      if (daysSinceSignup >= FREE_GRACE_DAYS) {
        await admin.from('referrals').update({ status: 'qualified_free', qualified_at: now.toISOString() }).eq('id', ref.id);
        results.qualified_free++;
      }
      // else: still pending, too new -- leave as-is, checked again next run.
    } catch (err) {
      console.error('[referral-qualification-cron] error processing referral', ref.id, err.message);
      results.errors.push({ referral_id: ref.id, error: err.message });
    }
  }

  // ── Batch-credit free referrals (groups of 3), per referrer ────────────────
  const { data: uncreditedFree, error: freeErr } = await admin
    .from('referrals')
    .select('id, referrer_id')
    .eq('status', 'qualified_free')
    .eq('batch_credited', false);
  if (freeErr) return res.status(500).json({ error: freeErr.message });

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
      console.error('[referral-qualification-cron] error batch-crediting referrer', referrerId, err.message);
      results.errors.push({ referrer_id: referrerId, error: err.message });
    }
  }

  // ── Milestone bonuses ────────────────────────────────────────────────────
  // Recompute for every referrer with at least one qualified referral --
  // upsertReferralStats above already kept totals current; this just
  // checks for newly-crossed thresholds against what's already been paid.
  const { data: statsRows, error: statsErr } = await admin
    .from('referral_stats')
    .select('user_id, total_qualified_referrals, milestones_claimed');
  if (statsErr) return res.status(500).json({ error: statsErr.message });

  for (const row of statsRows || []) {
    try {
      const newlyClaimed = await checkAndApplyMilestones(admin, row.user_id, row.total_qualified_referrals, row.milestones_claimed || []);
      results.milestones_applied += newlyClaimed.length;
    } catch (err) {
      console.error('[referral-qualification-cron] error applying milestones for', row.user_id, err.message);
      results.errors.push({ user_id: row.user_id, error: err.message });
    }
  }

  return res.status(200).json({ success: true, ran_at: now.toISOString(), results });
}
