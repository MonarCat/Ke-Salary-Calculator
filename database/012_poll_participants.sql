-- Migration 012: Poll participants table for unique vote enforcement
-- Run this in the Supabase SQL Editor.

-- Track individual poll votes so each user/device can only vote once per poll
create table if not exists poll_participants (
    id          bigserial    primary key,
    poll_idx    smallint     not null,
    user_id     uuid         references auth.users(id) on delete set null,
    anon_token  uuid,
    option_idx  smallint     not null,
    created_at  timestamptz  not null default now(),
    -- At least one identifier must be present
    constraint chk_poll_identity check (user_id is not null or anon_token is not null)
);

-- Partial unique indexes prevent duplicates while correctly ignoring NULL values:
--   authenticated users: one vote per (poll, user_id)
create unique index if not exists uq_poll_user on poll_participants (poll_idx, user_id) where user_id is not null;
--   anonymous users: one vote per (poll, anon_token)
create unique index if not exists uq_poll_anon on poll_participants (poll_idx, anon_token) where anon_token is not null;

-- Enable Row Level Security – all access goes through SECURITY DEFINER functions
alter table poll_participants enable row level security;

-- No direct-access policies: only SECURITY DEFINER RPCs can read/write this table

-- ── submit_poll_vote ──────────────────────────────────────────────────────────
-- Replaces increment_poll_vote.
-- Accepts an optional anon_token UUID (generated client-side for anonymous users).
-- For authenticated users, auth.uid() is used automatically.
-- Returns JSON: { "already_voted": true/false, "option_idx": <int or null> }
-- Race-condition-safe: the unique constraint violation is caught and handled.
create or replace function submit_poll_vote(
    p_poll_idx   smallint,
    p_option_idx smallint,
    p_anon_token uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id     uuid;
    v_prev_option smallint;
begin
    -- Validate inputs: 3 polls (0-2) each with 4 options (0-3)
    if p_poll_idx < 0 or p_poll_idx > 2 then
        raise exception 'Invalid poll_idx: %', p_poll_idx;
    end if;
    if p_option_idx < 0 or p_option_idx > 3 then
        raise exception 'Invalid option_idx: %', p_option_idx;
    end if;

    v_user_id := auth.uid();

    -- Reject if no identity is available (unauthenticated and no anon token)
    if v_user_id is null and p_anon_token is null then
        raise exception 'No voter identity provided';
    end if;

    -- Attempt to insert the participant record.
    -- The unique constraints (uq_poll_user / uq_poll_anon) guard against duplicates
    -- and handle concurrent requests without a separate SELECT first.
    begin
        insert into poll_participants (poll_idx, user_id, anon_token, option_idx)
        values (p_poll_idx, v_user_id, p_anon_token, p_option_idx);
    exception
        when unique_violation then
            -- A row already exists for this identity + poll; look it up and return
            if v_user_id is not null then
                select option_idx into v_prev_option
                from poll_participants
                where poll_idx = p_poll_idx and user_id = v_user_id
                limit 1;
            else
                select option_idx into v_prev_option
                from poll_participants
                where poll_idx = p_poll_idx and anon_token = p_anon_token
                limit 1;
            end if;
            return jsonb_build_object('already_voted', true, 'option_idx', v_prev_option::int);
    end;

    -- Increment the aggregate vote counter
    insert into poll_votes (poll_idx, option_idx, count)
    values (p_poll_idx, p_option_idx, 1)
    on conflict (poll_idx, option_idx)
    do update set count = poll_votes.count + 1;

    return jsonb_build_object('already_voted', false, 'option_idx', p_option_idx::int);
end;
$$;

-- ── check_poll_vote ───────────────────────────────────────────────────────────
-- Returns whether the current session has already voted in a given poll.
-- Returns JSON: { "voted": true/false, "option_idx": <int or null> }
create or replace function check_poll_vote(
    p_poll_idx   smallint,
    p_anon_token uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id     uuid;
    v_option_idx  smallint;
begin
    if p_poll_idx < 0 or p_poll_idx > 2 then
        raise exception 'Invalid poll_idx: %', p_poll_idx;
    end if;

    v_user_id := auth.uid();

    if v_user_id is not null then
        select option_idx into v_option_idx
        from poll_participants
        where poll_idx = p_poll_idx
          and user_id  = v_user_id
        limit 1;
    elsif p_anon_token is not null then
        select option_idx into v_option_idx
        from poll_participants
        where poll_idx   = p_poll_idx
          and anon_token = p_anon_token
        limit 1;
    end if;

    return jsonb_build_object(
        'voted',      v_option_idx is not null,
        'option_idx', v_option_idx::int
    );
end;
$$;

-- Keep the old increment_poll_vote function in place for backwards compatibility
-- but mark it deprecated via a comment.
comment on function increment_poll_vote(smallint, smallint) is
    'Deprecated – use submit_poll_vote() which enforces one vote per participant.';
