/**
 * /assets/js/referral-widget.js
 *
 * Refer & Earn card for account.html. Reads the user's permanent referral
 * code and live stats via the get_my_referral_summary() SECURITY DEFINER
 * RPC (never queries referrals/referral_stats directly -- those tables
 * are fully locked to direct client access by design).
 *
 * Usage:
 *   import { initReferralWidget } from '/assets/js/referral-widget.js';
 *   initReferralWidget(supabaseClient, 'sc-referral-widget');
 */

const REWARD_RULES_HTML = `
  <ul style="margin:10px 0 0;padding-left:20px;font-size:13px;line-height:1.9;color:#475569">
    <li><strong>3 friends sign up free</strong> → you get 1 month Premium</li>
    <li><strong>1 friend goes Monthly Premium</strong> → you get 1 month Premium</li>
    <li><strong>1 friend goes Yearly Premium</strong> → you get 4 months Premium</li>
  </ul>
  <div style="margin-top:10px;font-size:12px;color:#64748b">
    Bonus milestones: 5 referrals +15 days · 10 +1 month · 15 +6 weeks · 25 +3 months · 50 +6 months · 100+ Lifetime Premium 🎉
  </div>
`;

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function initReferralWidget(supabase, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `<div style="font-size:13px;color:#64748b;padding:12px 0">Loading your referral details…</div>`;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    container.innerHTML = '';
    return; // logged-out visitors don't see this widget at all
  }

  let summary;
  try {
    const { data, error } = await supabase.rpc('get_my_referral_summary');
    if (error) throw error;
    summary = Array.isArray(data) ? data[0] : data;
  } catch (err) {
    console.error('[referral-widget] Could not load referral summary:', err.message);
    container.innerHTML = `<div style="font-size:13px;color:#b91c1c;padding:12px 0">Could not load your referral details right now. Please refresh the page.</div>`;
    return;
  }

  if (!summary?.referral_code) {
    container.innerHTML = '';
    return;
  }

  const code = summary.referral_code;
  const shareLink = `https://salarycalculator.co.ke/auth.html?ref=${encodeURIComponent(code)}`;
  const daysEarned = Number(summary.total_premium_days_earned || 0);
  const totalReferrals = Number(summary.total_qualified_referrals || 0);
  const pending = Number(summary.pending_referrals || 0);
  const isLifetime = !!summary.is_lifetime_premium;

  container.innerHTML = `
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px 20px;margin-bottom:14px">
      <h3 style="margin:0 0 4px;color:#006600;font-size:1.05rem">🎁 Refer &amp; Earn Premium</h3>
      <p style="margin:0 0 14px;color:#475569;font-size:0.88rem">Share your code — when friends sign up or go Premium, you earn free Premium time.</p>

      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px">
        <div style="font-family:monospace;font-size:1.3rem;font-weight:800;color:#111827;background:#f0fdf6;border:2px dashed #16a34a;border-radius:8px;padding:8px 18px;letter-spacing:2px">${escapeHtml(code)}</div>
        <button type="button" id="sc-ref-copy-code" style="background:#16a34a;color:#fff;border:none;border-radius:8px;padding:10px 16px;font-weight:700;font-size:13px;cursor:pointer">Copy Code</button>
        <button type="button" id="sc-ref-copy-link" style="background:#fff;color:#16a34a;border:1px solid #16a34a;border-radius:8px;padding:10px 16px;font-weight:700;font-size:13px;cursor:pointer">Copy Share Link</button>
      </div>

      ${REWARD_RULES_HTML}

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-top:16px">
        <div style="background:#f8fafc;border-radius:8px;padding:10px 12px;text-align:center">
          <div style="font-size:1.4rem;font-weight:800;color:#111827">${totalReferrals}</div>
          <div style="font-size:11px;color:#64748b">Qualified referrals</div>
        </div>
        <div style="background:#f8fafc;border-radius:8px;padding:10px 12px;text-align:center">
          <div style="font-size:1.4rem;font-weight:800;color:#16a34a">${isLifetime ? '∞' : daysEarned}</div>
          <div style="font-size:11px;color:#64748b">${isLifetime ? 'Lifetime Premium' : 'Premium days earned'}</div>
        </div>
        <div style="background:#f8fafc;border-radius:8px;padding:10px 12px;text-align:center">
          <div style="font-size:1.4rem;font-weight:800;color:#f59e0b">${pending}</div>
          <div style="font-size:11px;color:#64748b">Pending (awaiting qualification)</div>
        </div>
      </div>
    </div>
  `;

  const copyText = async (text, btn, label) => {
    try {
      await navigator.clipboard.writeText(text);
      const original = btn.textContent;
      btn.textContent = '✓ Copied!';
      setTimeout(() => { btn.textContent = original; }, 1800);
    } catch (_err) {
      alert(`${label}: ${text}`); // clipboard API unavailable -- fall back to a visible prompt
    }
  };

  document.getElementById('sc-ref-copy-code')?.addEventListener('click', (e) => copyText(code, e.currentTarget, 'Your referral code'));
  document.getElementById('sc-ref-copy-link')?.addEventListener('click', (e) => copyText(shareLink, e.currentTarget, 'Your referral link'));
}
