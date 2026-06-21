create table if not exists public.ledger_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  amount numeric(14, 2) not null default 0,
  bucket text not null check (bucket in ('needs', 'wants', 'savings')),
  expense_date date not null default current_date,
  month text not null,
  tags text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  account_type text not null check (
    account_type in ('checking', 'savings', 'hysa', 'money_market', 'cash', 'brokerage', 'crypto', 'retirement', 'other')
  ),
  balance numeric(14, 2) not null default 0,
  category text not null check (category in ('cash', 'investment')),
  institution text,
  notes text,
  last_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ledger_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_base numeric(14, 2) not null default 0,
  split_needs integer not null default 40 check (split_needs >= 0 and split_needs <= 100),
  split_wants integer not null default 40 check (split_wants >= 0 and split_wants <= 100),
  split_savings integer not null default 20 check (split_savings >= 0 and split_savings <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ledger_settings_split_total check (split_needs + split_wants + split_savings = 100)
);

create index if not exists ledger_expenses_user_month_idx
  on public.ledger_expenses (user_id, month, expense_date desc);

create index if not exists ledger_accounts_user_category_idx
  on public.ledger_accounts (user_id, category, account_type, name);

alter table public.ledger_expenses enable row level security;
alter table public.ledger_accounts enable row level security;
alter table public.ledger_settings enable row level security;

drop policy if exists "Users can manage own ledger expenses" on public.ledger_expenses;
create policy "Users can manage own ledger expenses"
on public.ledger_expenses
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage own ledger accounts" on public.ledger_accounts;
create policy "Users can manage own ledger accounts"
on public.ledger_accounts
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage own ledger settings" on public.ledger_settings;
create policy "Users can manage own ledger settings"
on public.ledger_settings
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
