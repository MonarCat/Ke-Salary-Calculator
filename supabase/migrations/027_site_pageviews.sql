-- First-party, privacy-friendly pageview analytics.
-- Stores ONLY aggregate counts per day/country/path/device/referrer-host.
-- No IP addresses, cookies, user ids or fingerprints are stored.

create table if not exists public.site_pageviews_daily (
  day      date    not null,
  country  text    not null default 'XX',
  path     text    not null,
  device   text    not null default 'unknown',
  referrer text    not null default '',
  views    integer not null default 0,
  primary key (day, country, path, device, referrer)
);

alter table public.site_pageviews_daily enable row level security;
-- Intentionally NO policies: only the service role (API) may read/write.

create or replace function public.record_pageview(
  p_country text, p_path text, p_device text, p_referrer text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.site_pageviews_daily (day, country, path, device, referrer, views)
  values (
    (now() at time zone 'Africa/Nairobi')::date,
    upper(left(coalesce(nullif(p_country, ''), 'XX'), 2)),
    left(coalesce(p_path, '/'), 200),
    left(coalesce(nullif(p_device, ''), 'unknown'), 10),
    left(coalesce(p_referrer, ''), 100),
    1
  )
  on conflict (day, country, path, device, referrer)
  do update set views = public.site_pageviews_daily.views + 1;
end $$;

create or replace function public.get_pageview_stats()
returns json
language sql security definer set search_path = public as $$
  with today as (select (now() at time zone 'Africa/Nairobi')::date d)
  select json_build_object(
    'today',    coalesce((select sum(views) from site_pageviews_daily, today where day = today.d), 0),
    'last_7d',  coalesce((select sum(views) from site_pageviews_daily, today where day > today.d - 7), 0),
    'last_30d', coalesce((select sum(views) from site_pageviews_daily, today where day > today.d - 30), 0),
    'all_time', coalesce((select sum(views) from site_pageviews_daily), 0),
    'countries', coalesce((
      select json_agg(json_build_object('country', country, 'views', v) order by v desc)
      from (select country, sum(views) v from site_pageviews_daily, today
            where day > today.d - 30 group by country order by v desc limit 15) c), '[]'::json),
    'daily', coalesce((
      select json_agg(json_build_object('day', day, 'views', v) order by day)
      from (select day, sum(views) v from site_pageviews_daily, today
            where day > today.d - 30 group by day) t), '[]'::json),
    'top_pages', coalesce((
      select json_agg(json_build_object('path', path, 'views', v) order by v desc)
      from (select path, sum(views) v from site_pageviews_daily, today
            where day > today.d - 30 group by path order by v desc limit 10) p), '[]'::json)
  );
$$;

revoke all on function public.record_pageview(text, text, text, text) from public, anon, authenticated;
revoke all on function public.get_pageview_stats() from public, anon, authenticated;
grant execute on function public.record_pageview(text, text, text, text) to service_role;
grant execute on function public.get_pageview_stats() to service_role;
