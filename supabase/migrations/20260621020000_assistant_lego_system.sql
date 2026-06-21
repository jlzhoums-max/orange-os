create table if not exists public.assistant_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  assistant_name text not null default 'Chéng zǐ',
  default_provider text not null default 'openai',
  default_model_mode text not null default 'cost',
  developer_mode_enabled boolean not null default false,
  memory jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.assistant_preferences enable row level security;

drop policy if exists "Users can manage their assistant preferences" on public.assistant_preferences;
create policy "Users can manage their assistant preferences"
  on public.assistant_preferences
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.assistant_layouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  surface text not null,
  modules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, surface)
);

alter table public.assistant_layouts enable row level security;

drop policy if exists "Users can manage their assistant layouts" on public.assistant_layouts;
create policy "Users can manage their assistant layouts"
  on public.assistant_layouts
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists assistant_layouts_user_surface_idx
  on public.assistant_layouts (user_id, surface);

create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  provider text,
  model text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.assistant_messages enable row level security;

drop policy if exists "Users can read their assistant messages" on public.assistant_messages;
create policy "Users can read their assistant messages"
  on public.assistant_messages
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their assistant messages" on public.assistant_messages;
create policy "Users can create their assistant messages"
  on public.assistant_messages
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create index if not exists assistant_messages_user_created_idx
  on public.assistant_messages (user_id, created_at desc);

create table if not exists public.assistant_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  reason text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.assistant_tasks enable row level security;

drop policy if exists "Users can manage their assistant tasks" on public.assistant_tasks;
create policy "Users can manage their assistant tasks"
  on public.assistant_tasks
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists assistant_tasks_user_created_idx
  on public.assistant_tasks (user_id, created_at desc);

grant select, insert, update, delete on public.assistant_preferences to authenticated;
grant select, insert, update, delete on public.assistant_layouts to authenticated;
grant select, insert on public.assistant_messages to authenticated;
grant select, insert, update, delete on public.assistant_tasks to authenticated;
