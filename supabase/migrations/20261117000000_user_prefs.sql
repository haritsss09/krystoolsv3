-- Per-user synced preferences: pinned tools, recently opened tools, theme.
create table if not exists public.user_prefs (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  favorites  jsonb not null default '[]'::jsonb,
  recent     jsonb not null default '[]'::jsonb,
  theme      text check (theme in ('dark', 'light')),
  updated_at timestamptz not null default now(),
  constraint user_prefs_favorites_array check (jsonb_typeof(favorites) = 'array' and jsonb_array_length(favorites) <= 200),
  constraint user_prefs_recent_array check (jsonb_typeof(recent) = 'array' and jsonb_array_length(recent) <= 50)
);

alter table public.user_prefs enable row level security;

drop policy if exists "own prefs: select" on public.user_prefs;
drop policy if exists "own prefs: insert" on public.user_prefs;
drop policy if exists "own prefs: update" on public.user_prefs;
drop policy if exists "own prefs: delete" on public.user_prefs;

create policy "own prefs: select" on public.user_prefs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own prefs: insert" on public.user_prefs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own prefs: update" on public.user_prefs
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own prefs: delete" on public.user_prefs
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.user_prefs from anon;
grant select, insert, update, delete on public.user_prefs to authenticated;
