create table if not exists public.todo_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  notes text not null default '',
  project text not null default 'Personal',
  due_date date,
  priority integer check (priority between 1 and 4),
  labels text[] not null default '{}',
  completed boolean not null default false,
  amount text,
  flagged boolean not null default false,
  someday boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists todo_tasks_user_due_idx
  on public.todo_tasks (user_id, due_date, completed);

create index if not exists todo_tasks_user_project_idx
  on public.todo_tasks (user_id, project, completed);

alter table public.todo_tasks enable row level security;

grant select, insert, update, delete on public.todo_tasks to authenticated;
grant select, insert, update, delete on public.todo_tasks to service_role;

drop policy if exists "Users can manage own todo tasks" on public.todo_tasks;
create policy "Users can manage own todo tasks"
on public.todo_tasks
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
