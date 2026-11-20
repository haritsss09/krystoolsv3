create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.user_flags (
  user_id uuid primary key references auth.users (id) on delete cascade,
  blocked boolean not null default false,
  ai_daily_limit integer check (ai_daily_limit is null or ai_daily_limit between 0 and 10000),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id integer primary key default 1 check (id = 1),
  ai_enabled boolean not null default true,
  net_enabled boolean not null default true,
  ai_daily_default integer not null default 50 check (ai_daily_default between 0 and 10000),
  announcement text not null default '' check (char_length(announcement) <= 500),
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.usage_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  fn text not null check (fn in ('ai', 'net-inspect')),
  ok boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists usage_log_user_time on public.usage_log (user_id, created_at desc);
create index if not exists usage_log_time on public.usage_log (created_at desc);

alter table public.admins enable row level security;
alter table public.user_flags enable row level security;
alter table public.app_settings enable row level security;
alter table public.usage_log enable row level security;

revoke all on public.admins, public.user_flags, public.usage_log from anon, authenticated;
revoke all on public.app_settings from anon, authenticated;
grant select (announcement, ai_enabled, net_enabled) on public.app_settings to authenticated;

drop policy if exists "signed-in users read site settings" on public.app_settings;
create policy "signed-in users read site settings" on public.app_settings
  for select to authenticated using (true);
