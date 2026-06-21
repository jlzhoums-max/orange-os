create table if not exists public.ai_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_part text not null,
  headline text not null,
  narrative text not null,
  focus_items jsonb not null default '[]'::jsonb,
  suggested_tasks jsonb not null default '[]'::jsonb,
  reply_drafts jsonb not null default '[]'::jsonb,
  project_updates jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_briefs enable row level security;

drop policy if exists "Users can read their own AI briefs" on public.ai_briefs;
create policy "Users can read their own AI briefs"
  on public.ai_briefs
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own AI briefs" on public.ai_briefs;
create policy "Users can create their own AI briefs"
  on public.ai_briefs
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create index if not exists ai_briefs_user_created_idx
  on public.ai_briefs (user_id, created_at desc);

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  trigger text not null,
  status text not null default 'started',
  gmail_count integer not null default 0,
  calendar_count integer not null default 0,
  market_count integer not null default 0,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.sync_runs enable row level security;

drop policy if exists "Users can read their own sync runs" on public.sync_runs;
create policy "Users can read their own sync runs"
  on public.sync_runs
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists sync_runs_user_started_idx
  on public.sync_runs (user_id, started_at desc);
