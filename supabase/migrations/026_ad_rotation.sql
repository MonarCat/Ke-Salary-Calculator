-- 026_ad_rotation.sql

create table if not exists public.ad_slots (
  slot_id text primary key,
  width int not null,
  height int not null,
  daily_rate integer not null,
  active boolean default true
);

insert into public.ad_slots (slot_id, width, height, daily_rate) values
  ('rail_left', 160, 600, 250),
  ('rail_right', 160, 600, 250),
  ('strip_below_results', 728, 90, 150)
on conflict (slot_id) do nothing;

create table if not exists public.ad_bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id text not null references public.ad_slots(slot_id),
  advertiser_name text not null,
  creative_url text not null,
  click_url text not null,
  start_date date not null,
  end_date date not null,
  weight int not null default 1,
  status text not null default 'pending',
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  created_at timestamptz default now()
);

create index if not exists idx_bookings_slot_active
  on public.ad_bookings (slot_id, status, start_date, end_date);

alter table public.ad_slots enable row level security;
alter table public.ad_bookings enable row level security;

drop policy if exists "public read active slots" on public.ad_slots;
create policy "public read active slots" on public.ad_slots
  for select using (active = true);

drop policy if exists "public read active bookings" on public.ad_bookings;
create policy "public read active bookings" on public.ad_bookings
  for select using (
    status = 'active'
    and start_date <= current_date
    and end_date >= current_date
  );

create or replace function public.increment_ad_impression(booking_id uuid)
returns void language sql security definer as $$
  update public.ad_bookings set impressions = impressions + 1 where id = booking_id;
$$;

create or replace function public.increment_ad_click(booking_id uuid)
returns void language sql security definer as $$
  update public.ad_bookings set clicks = clicks + 1 where id = booking_id;
$$;

insert into public.ad_bookings
  (slot_id, advertiser_name, creative_url, click_url, start_date, end_date, weight, status)
values
  ('rail_right', 'Afams', 'https://wznopthjoaqusalqoyru.supabase.co/storage/v1/object/public/ads/afams-rail-160x600.png',
   'https://afams.co.ke', current_date, current_date + interval '30 days', 1, 'active');
