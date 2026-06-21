create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.real_estate_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text,
  project_type text,
  status text not null default 'Lead',
  risk text not null default 'Low' check (risk in ('Low', 'Medium', 'High')),
  estimated_value numeric(14, 2) not null default 0,
  purchase_price numeric(14, 2) not null default 0,
  target_budget numeric(14, 2) not null default 0,
  progress integer not null default 0 check (progress between 0 and 100),
  due text,
  next_action text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.real_estate_projects(id) on delete cascade,
  category text not null,
  vendor text not null,
  amount numeric(14, 2) not null default 0,
  expense_date date not null,
  status text not null default 'Paid' check (status in ('Paid', 'Unpaid')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expense_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expense_id uuid not null references public.project_expenses(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  content_type text,
  created_at timestamptz not null default now()
);

create table if not exists public.connected_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  account_email text,
  scopes text[] not null default '{}',
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table if not exists public.synced_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gmail_message_id text not null,
  thread_id text,
  sender text,
  subject text,
  snippet text,
  received_at timestamptz,
  labels text[] not null default '{}',
  raw jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, gmail_message_id)
);

create table if not exists public.synced_calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  google_event_id text not null,
  calendar_id text not null default 'primary',
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  location text,
  attendees jsonb not null default '[]',
  raw jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, calendar_id, google_event_id)
);

create table if not exists public.market_watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  name text,
  created_at timestamptz not null default now(),
  unique (user_id, symbol)
);

create table if not exists public.market_quotes (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  price numeric(14, 4),
  change_percent numeric(9, 4),
  provider text not null,
  raw jsonb not null default '{}',
  fetched_at timestamptz not null default now()
);

create index if not exists real_estate_projects_user_id_idx on public.real_estate_projects(user_id);
create index if not exists project_expenses_project_id_idx on public.project_expenses(project_id);
create index if not exists project_expenses_user_id_idx on public.project_expenses(user_id);
create index if not exists expense_attachments_expense_id_idx on public.expense_attachments(expense_id);
create index if not exists connected_accounts_user_provider_idx on public.connected_accounts(user_id, provider);
create index if not exists synced_emails_user_received_idx on public.synced_emails(user_id, received_at desc);
create index if not exists synced_calendar_user_start_idx on public.synced_calendar_events(user_id, starts_at);
create index if not exists market_quotes_symbol_fetched_idx on public.market_quotes(symbol, fetched_at desc);

alter table public.profiles enable row level security;
alter table public.real_estate_projects enable row level security;
alter table public.project_expenses enable row level security;
alter table public.expense_attachments enable row level security;
alter table public.connected_accounts enable row level security;
alter table public.synced_emails enable row level security;
alter table public.synced_calendar_events enable row level security;
alter table public.market_watchlist enable row level security;
alter table public.market_quotes enable row level security;

drop policy if exists "Users can manage own profile" on public.profiles;
create policy "Users can manage own profile"
on public.profiles
for all
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Users can manage own projects" on public.real_estate_projects;
create policy "Users can manage own projects"
on public.real_estate_projects
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage own expenses" on public.project_expenses;
create policy "Users can manage own expenses"
on public.project_expenses
for all
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.real_estate_projects p
    where p.id = project_id and p.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can manage own expense attachments" on public.expense_attachments;
create policy "Users can manage own expense attachments"
on public.expense_attachments
for all
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.project_expenses e
    where e.id = expense_id and e.user_id = (select auth.uid())
  )
);

-- connected_accounts contains provider tokens. Do not expose rows through the
-- browser Data API; server routes use the secret key and return safe status.

drop policy if exists "Users can manage own synced emails" on public.synced_emails;
create policy "Users can manage own synced emails"
on public.synced_emails
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage own calendar events" on public.synced_calendar_events;
create policy "Users can manage own calendar events"
on public.synced_calendar_events
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage own watchlist" on public.market_watchlist;
create policy "Users can manage own watchlist"
on public.market_watchlist
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Authenticated users can read market quotes" on public.market_quotes;
create policy "Authenticated users can read market quotes"
on public.market_quotes
for select
to authenticated
using (true);

insert into storage.buckets (id, name, public)
values ('expense-attachments', 'expense-attachments', false)
on conflict (id) do nothing;

drop policy if exists "Users can read own expense files" on storage.objects;
create policy "Users can read own expense files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'expense-attachments'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can upload own expense files" on storage.objects;
create policy "Users can upload own expense files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'expense-attachments'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can update own expense files" on storage.objects;
create policy "Users can update own expense files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'expense-attachments'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'expense-attachments'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can delete own expense files" on storage.objects;
create policy "Users can delete own expense files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'expense-attachments'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        avatar_url = excluded.avatar_url,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
