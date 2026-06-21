create table if not exists public.synced_calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connected_account_id uuid not null references public.connected_accounts(id) on delete cascade,
  google_calendar_id text not null,
  summary text,
  description text,
  time_zone text,
  background_color text,
  foreground_color text,
  access_role text,
  is_primary boolean not null default false,
  selected boolean not null default true,
  raw jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, connected_account_id, google_calendar_id)
);

alter table public.synced_calendars enable row level security;

drop policy if exists "Users can manage own synced calendars" on public.synced_calendars;
create policy "Users can manage own synced calendars"
on public.synced_calendars
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

alter table public.synced_calendar_events
  add column if not exists status text,
  add column if not exists html_link text,
  add column if not exists creator jsonb,
  add column if not exists organizer jsonb,
  add column if not exists recurring_event_id text,
  add column if not exists all_day boolean not null default false,
  add column if not exists time_zone text,
  add column if not exists google_updated_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists synced_calendars_user_account_idx
  on public.synced_calendars (user_id, connected_account_id);

create index if not exists synced_calendar_events_user_account_start_idx
  on public.synced_calendar_events (user_id, connected_account_id, starts_at);

grant select, insert, update, delete on public.synced_calendars to authenticated;
