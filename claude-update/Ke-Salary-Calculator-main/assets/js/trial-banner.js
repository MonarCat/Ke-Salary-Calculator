/**
 * /assets/js/trial-banner.js
 *
 * Trial period has been removed (migration 008_remove_trial_strategy.sql).
 * This module is kept for backwards-compatibility so imports don't break.
 */

// No-op: trial is removed.
// eslint-disable-next-line no-unused-vars
export async function initTrialBanner(_supabase) {
  // Trial strategy removed — nothing to show.
}
