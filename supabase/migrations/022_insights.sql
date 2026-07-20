-- Goals + insights (Pro-gated review inbox).

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  product_id text references public.products (id) on delete cascade,
  scope text not null check (scope in ('workspace', 'product')),
  title text not null,
  metric text not null default 'custom' check (
    metric in ('roas', 'cac', 'revenue', 'conversions', 'custom')
  ),
  target_value numeric,
  target_unit text,
  horizon text not null default 'ongoing' check (
    horizon in ('weekly', 'monthly', 'quarterly', 'ongoing')
  ),
  status text not null default 'active' check (
    status in ('active', 'paused', 'achieved', 'archived')
  ),
  notes text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goals_scope_product check (
    (scope = 'workspace' and product_id is null)
    or (scope = 'product' and product_id is not null)
  )
);

create index if not exists goals_workspace_created_idx
  on public.goals (workspace_id, created_at desc);

create index if not exists goals_product_idx
  on public.goals (product_id, created_at desc)
  where product_id is not null;

create index if not exists goals_workspace_status_idx
  on public.goals (workspace_id, status);

alter table public.goals enable row level security;

create policy "goals_member_all" on public.goals
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create table if not exists public.insights (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  product_id text references public.products (id) on delete set null,
  campaign_id text references public.campaigns (id) on delete set null,
  goal_id uuid references public.goals (id) on delete set null,
  title text not null default '',
  summary text not null default '',
  rationale text not null default '',
  status text not null default 'generating' check (
    status in (
      'generating',
      'awaiting_review',
      'revising',
      'accepted',
      'rejected',
      'failed'
    )
  ),
  trigger_source text not null check (
    trigger_source in ('job', 'agent', 'heartbeat', 'api')
  ),
  trigger_ref jsonb,
  action jsonb,
  revision_feedback text,
  active_job_id uuid references public.job_runs (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists insights_workspace_created_idx
  on public.insights (workspace_id, created_at desc);

create index if not exists insights_product_idx
  on public.insights (product_id, created_at desc)
  where product_id is not null;

create index if not exists insights_status_idx
  on public.insights (workspace_id, status);

create index if not exists insights_goal_idx
  on public.insights (goal_id)
  where goal_id is not null;

alter table public.insights enable row level security;

create policy "insights_member_all" on public.insights
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- Extend job_runs.type for insight generation.
alter table public.job_runs
  drop constraint if exists job_runs_type_check;

alter table public.job_runs
  add constraint job_runs_type_check check (
    type in (
      'create_campaign',
      'generate_creative_screenplay',
      'generate_creative_storyboard',
      'generate_creative_video',
      'generate_insight'
    )
  );
