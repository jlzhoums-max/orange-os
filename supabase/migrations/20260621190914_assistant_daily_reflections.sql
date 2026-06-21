create table if not exists public.assistant_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reflection_date date not null,
  summary text not null,
  learned_preferences jsonb not null default '{}'::jsonb,
  command_patterns jsonb not null default '[]'::jsonb,
  shortcut_candidates jsonb not null default '[]'::jsonb,
  code_notes jsonb not null default '[]'::jsonb,
  unresolved_questions jsonb not null default '[]'::jsonb,
  provider text,
  model text,
  token_usage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, reflection_date)
);

alter table public.assistant_reflections enable row level security;

drop policy if exists "Users can read their assistant reflections" on public.assistant_reflections;
create policy "Users can read their assistant reflections"
  on public.assistant_reflections
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.assistant_reflections to authenticated;

create index if not exists assistant_reflections_user_date_idx
  on public.assistant_reflections (user_id, reflection_date desc);
