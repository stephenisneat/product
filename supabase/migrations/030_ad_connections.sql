-- Ad channel connections (Google Ads initially). Parallel to commerce_connections.

create table if not exists public.ad_connections (
  id text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null check (provider in ('google')),
  -- Google Ads customer ID without dashes; null until the user selects an account
  external_account_id text,
  -- Manager (MCC) customer ID when operating under a manager account
  login_customer_id text,
  account_name text not null default '',
  currency_code text,
  time_zone text,
  is_manager boolean not null default false,
  refresh_token text not null,
  access_token text,
  token_expires_at timestamptz,
  scope text not null default '',
  status text not null default 'active'
    check (status in ('active', 'disconnected', 'error', 'pending')),
  connected_by uuid references auth.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One linked Google Ads customer per workspace (pending rows use null account id)
create unique index if not exists ad_connections_workspace_provider_account_uidx
  on public.ad_connections (workspace_id, provider, external_account_id)
  where external_account_id is not null;

-- At most one pending OAuth credential row per workspace+provider
create unique index if not exists ad_connections_workspace_provider_pending_uidx
  on public.ad_connections (workspace_id, provider)
  where status = 'pending' and external_account_id is null;

create index if not exists ad_connections_workspace_id_idx
  on public.ad_connections (workspace_id);

create index if not exists ad_connections_provider_status_idx
  on public.ad_connections (provider, status);

alter table public.ad_connections enable row level security;

drop policy if exists "ad_connections_member_all" on public.ad_connections;

create policy "ad_connections_member_all" on public.ad_connections
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
