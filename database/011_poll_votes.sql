-- Migration 011: Poll votes table for real participant tracking
-- Run this in the Supabase SQL Editor.

-- Create poll_votes table to store per-option vote counts
create table if not exists poll_votes (
    poll_idx   smallint not null,
    option_idx smallint not null,
    count      integer  not null default 0,
    primary key (poll_idx, option_idx)
);

-- Enable Row Level Security
alter table poll_votes enable row level security;

-- Allow all visitors (including anonymous) to read vote counts
create policy "poll_votes_public_read" on poll_votes
    for select using (true);

-- SECURITY DEFINER function so anonymous visitors can increment a vote
-- without needing direct write access to the table
create or replace function increment_poll_vote(p_poll_idx smallint, p_option_idx smallint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    -- Validate inputs: 3 polls (0-2) each with 4 options (0-3)
    if p_poll_idx < 0 or p_poll_idx > 2 then
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

-- Seed empty rows for each poll/option so SELECT always returns results
insert into poll_votes (poll_idx, option_idx, count) values
    (0, 0, 0), (0, 1, 0), (0, 2, 0), (0, 3, 0),
    (1, 0, 0), (1, 1, 0), (1, 2, 0), (1, 3, 0),
    (2, 0, 0), (2, 1, 0), (2, 2, 0), (2, 3, 0)
on conflict do nothing;
