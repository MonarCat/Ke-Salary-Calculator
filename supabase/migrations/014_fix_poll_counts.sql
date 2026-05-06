-- Migration 014: Fix poll counts, seed missing rows, add helper functions.
-- Run this in the Supabase SQL Editor after migrations 011–013.
--
-- Fixes:
--   1. Creates get_poll_participant_count() – referenced by the frontend but never deployed.
--   2. Seeds poll_votes rows for polls 3-11 (migration 011 only seeded 0-2).
--   3. Backfills poll_votes.count from poll_participants so counts already in
--      poll_participants are not lost.
--   4. Fixes legacy increment_poll_vote() – previous guard rejected poll_idx > 2,
--      which broke the fallback path for any poll beyond the first three.

-- ── 1. get_poll_participant_count ─────────────────────────────────────────────
-- Returns the number of unique participants (rows) in poll_participants for the
-- given poll, which is the authoritative "N Participated" count shown in the UI.
create or replace function public.get_poll_participant_count(p_poll_idx integer)
returns bigint
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::bigint
  from public.poll_participants
  where poll_idx = p_poll_idx;
$$;

-- ── 2. Seed poll_votes rows for polls 3-11 ───────────────────────────────────
-- These rows were missing because migration 011 only seeded polls 0-2.
-- Using ON CONFLICT DO NOTHING so re-running this migration is safe.
insert into public.poll_votes (poll_idx, option_idx, count) values
    (3, 0, 0),  (3, 1, 0),  (3, 2, 0),  (3, 3, 0),
    (4, 0, 0),  (4, 1, 0),  (4, 2, 0),  (4, 3, 0),
    (5, 0, 0),  (5, 1, 0),  (5, 2, 0),  (5, 3, 0),
    (6, 0, 0),  (6, 1, 0),  (6, 2, 0),  (6, 3, 0),
    (7, 0, 0),  (7, 1, 0),  (7, 2, 0),  (7, 3, 0),
    (8, 0, 0),  (8, 1, 0),  (8, 2, 0),  (8, 3, 0),
    (9, 0, 0),  (9, 1, 0),  (9, 2, 0),  (9, 3, 0),
    (10, 0, 0), (10, 1, 0), (10, 2, 0), (10, 3, 0),
    (11, 0, 0), (11, 1, 0), (11, 2, 0), (11, 3, 0)
on conflict do nothing;

-- ── 3. Backfill poll_votes.count from poll_participants ───────────────────────
-- Votes recorded before migration 013 (which added the poll_votes increment to
-- submit_poll_vote) are present in poll_participants but not in poll_votes.
-- This UPDATE syncs the counts so historical votes are not lost.
update public.poll_votes pv
set count = (
    select count(*)
    from public.poll_participants pp
    where pp.poll_idx   = pv.poll_idx
      and pp.option_idx = pv.option_idx
);

-- ── 4. Fix legacy increment_poll_vote ────────────────────────────────────────
-- The previous version rejected poll_idx > 2 (only 3 polls were expected).
-- Now that 12 polls exist the guard is widened to match POLLS.length - 1 = 11.
create or replace function increment_poll_vote(p_poll_idx smallint, p_option_idx smallint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if p_poll_idx < 0 or p_poll_idx > 11 then
        raise exception 'Invalid poll_idx: %', p_poll_idx;
    end if;
    if p_option_idx < 0 or p_option_idx > 3 then
        raise exception 'Invalid option_idx: %', p_option_idx;
    end if;

    insert into poll_votes (poll_idx, option_idx, count)
    values (p_poll_idx, p_option_idx, 1)
    on conflict (poll_idx, option_idx)
    do update set count = poll_votes.count + 1;
end;
$$;
