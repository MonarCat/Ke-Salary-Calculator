-- Migration 013: Patch poll RPC functions deployed in migration 012.
-- Run this in the Supabase SQL Editor after migration 012.
--
-- Fixes:
--   1. submit_poll_vote – now increments poll_votes so aggregate counts stay correct.
--   2. check_poll_vote  – now returns option_idx so the frontend can highlight the
--                         previously-chosen option when a returning user visits.

-- ── submit_poll_vote ──────────────────────────────────────────────────────────
-- Returns JSON: { "already_voted": true/false, "option_idx": <int> }
-- On duplicate, returns the option_idx the user originally voted for (not the
-- newly clicked one).
create or replace function public.submit_poll_vote(
  p_poll_idx   integer,
  p_option_idx integer,
  p_anon_token text default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id       uuid;
  v_prev_option   integer;
begin
  v_user_id := auth.uid();

  begin
    insert into public.poll_participants (poll_idx, user_id, anon_token, option_idx)
    values (
      p_poll_idx,
      v_user_id,
      case when v_user_id is null then p_anon_token else null end,
      p_option_idx
    );
  exception
    when unique_violation then
      -- Look up the option they originally voted for
      if v_user_id is not null then
        select option_idx into v_prev_option
        from public.poll_participants
        where poll_idx = p_poll_idx and user_id = v_user_id
        limit 1;
      else
        select option_idx into v_prev_option
        from public.poll_participants
        where poll_idx = p_poll_idx and anon_token = p_anon_token
        limit 1;
      end if;
      return json_build_object('already_voted', true, 'option_idx', v_prev_option);
  end;

  -- Increment the aggregate vote counter used for display
  insert into public.poll_votes (poll_idx, option_idx, count)
  values (p_poll_idx, p_option_idx, 1)
  on conflict (poll_idx, option_idx)
  do update set count = public.poll_votes.count + 1;

  return json_build_object('already_voted', false, 'option_idx', p_option_idx);
end;
$$;

-- ── check_poll_vote ───────────────────────────────────────────────────────────
-- Returns JSON: { "already_voted": true/false, "option_idx": <int or null> }
create or replace function public.check_poll_vote(
  p_poll_idx   integer,
  p_anon_token text default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id    uuid;
  v_option_idx integer;
begin
  v_user_id := auth.uid();

  if v_user_id is not null then
    select option_idx into v_option_idx
    from public.poll_participants
    where poll_idx = p_poll_idx
      and user_id  = v_user_id
    limit 1;
  elsif p_anon_token is not null then
    select option_idx into v_option_idx
    from public.poll_participants
    where poll_idx   = p_poll_idx
      and anon_token = p_anon_token
    limit 1;
  end if;

  return json_build_object(
    'already_voted', v_option_idx is not null,
    'option_idx',    v_option_idx
  );
end;
$$;
