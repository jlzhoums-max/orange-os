alter table public.connected_accounts
  add column if not exists provider_account_id text,
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists is_primary boolean not null default false;

update public.connected_accounts
set provider_account_id = coalesce(provider_account_id, account_email, id::text)
where provider_account_id is null;

alter table public.connected_accounts
  alter column provider_account_id set not null;

alter table public.connected_accounts
  drop constraint if exists connected_accounts_user_id_provider_key;

create unique index if not exists connected_accounts_user_provider_account_idx
  on public.connected_accounts (user_id, provider, provider_account_id);

create unique index if not exists connected_accounts_user_provider_email_idx
  on public.connected_accounts (user_id, provider, lower(account_email))
  where account_email is not null;

create unique index if not exists connected_accounts_one_primary_google_idx
  on public.connected_accounts (user_id, provider)
  where provider = 'google' and is_primary;

alter table public.synced_emails
  add column if not exists connected_account_id uuid references public.connected_accounts(id) on delete cascade;

alter table public.synced_calendar_events
  add column if not exists connected_account_id uuid references public.connected_accounts(id) on delete cascade;

alter table public.sync_runs
  add column if not exists connected_account_id uuid references public.connected_accounts(id) on delete set null;

update public.synced_emails se
set connected_account_id = ca.id
from public.connected_accounts ca
where se.connected_account_id is null
  and ca.user_id = se.user_id
  and ca.provider = 'google';

update public.synced_calendar_events sce
set connected_account_id = ca.id
from public.connected_accounts ca
where sce.connected_account_id is null
  and ca.user_id = sce.user_id
  and ca.provider = 'google';

update public.sync_runs sr
set connected_account_id = ca.id
from public.connected_accounts ca
where sr.connected_account_id is null
  and ca.user_id = sr.user_id
  and ca.provider = 'google';

alter table public.synced_emails
  drop constraint if exists synced_emails_user_id_gmail_message_id_key;

alter table public.synced_calendar_events
  drop constraint if exists synced_calendar_events_user_id_calendar_id_google_event_id_key;

create unique index if not exists synced_emails_user_account_message_idx
  on public.synced_emails (user_id, connected_account_id, gmail_message_id);

create unique index if not exists synced_calendar_user_account_event_idx
  on public.synced_calendar_events (user_id, connected_account_id, calendar_id, google_event_id);

create index if not exists synced_emails_user_account_received_idx
  on public.synced_emails (user_id, connected_account_id, received_at desc);
