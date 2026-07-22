-- External ad-platform campaign mirrors + daily performance points.
-- Sync jobs write via service role; members read via RLS.

create table if not exists public.external_campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  connection_id text not null references public.ad_connections (id) on delete cascade,
  provider text not null check (
    provider in ('google', 'meta', 'tiktok', 'amazon', 'x')
  ),
  external_id text not null,
  name text not null default '',
  status text,
  channel_type text,
  currency_code text,
  product_id text references public.products (id) on delete set null,
  campaign_id text references public.campaigns (id) on delete set null,
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, external_id)
);

create index if not exists external_campaigns_workspace_id_idx
  on public.external_campaigns (workspace_id);

create index if not exists external_campaigns_product_id_idx
  on public.external_campaigns (product_id)
  where product_id is not null;

create index if not exists external_campaigns_provider_idx
  on public.external_campaigns (workspace_id, provider);

alter table public.external_campaigns enable row level security;

drop policy if exists "external_campaigns_member_all" on public.external_campaigns;

create policy "external_campaigns_member_all" on public.external_campaigns
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create table if not exists public.campaign_performance_points (
  external_campaign_id uuid not null
    references public.external_campaigns (id) on delete cascade,
  date date not null,
  impressions integer not null default 0,
  clicks integer not null default 0,
  spend numeric(12, 2) not null default 0,
  conversions numeric(12, 2) not null default 0,
  revenue numeric(12, 2) not null default 0,
  primary key (external_campaign_id, date)
);

create index if not exists campaign_performance_points_date_idx
  on public.campaign_performance_points (date);

alter table public.campaign_performance_points enable row level security;

drop policy if exists "campaign_performance_select_workspace"
  on public.campaign_performance_points;

create policy "campaign_performance_select_workspace"
  on public.campaign_performance_points
  for select
  using (
    exists (
      select 1
      from public.external_campaigns ec
      where ec.id = campaign_performance_points.external_campaign_id
        and public.is_workspace_member(ec.workspace_id)
    )
  );

-- Members may upsert via authenticated client when needed; sync jobs use service role.
drop policy if exists "campaign_performance_member_write"
  on public.campaign_performance_points;

create policy "campaign_performance_member_write"
  on public.campaign_performance_points
  for all
  using (
    exists (
      select 1
      from public.external_campaigns ec
      where ec.id = campaign_performance_points.external_campaign_id
        and public.is_workspace_member(ec.workspace_id)
    )
  )
  with check (
    exists (
      select 1
      from public.external_campaigns ec
      where ec.id = campaign_performance_points.external_campaign_id
        and public.is_workspace_member(ec.workspace_id)
    )
  );

alter table public.job_runs
  drop constraint if exists job_runs_type_check;

alter table public.job_runs
  add constraint job_runs_type_check check (
    type in (
      'create_campaign',
      'generate_creative_screenplay',
      'generate_creative_storyboard',
      'generate_creative_video',
      'generate_creative_concept',
      'generate_creative_assets',
      'render_creative_video',
      'generate_insight',
      'sync_ad_performance'
    )
  );
