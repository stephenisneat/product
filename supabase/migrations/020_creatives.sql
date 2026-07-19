-- First-class multi-stage creatives (video ads: screenplay → storyboard → video).

create table if not exists public.creatives (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  product_id text not null references public.products (id) on delete cascade,
  campaign_id text references public.campaigns (id) on delete set null,
  kind text not null default 'video_ad' check (kind in ('video_ad')),
  title text not null,
  brief text not null default '',
  stage text not null default 'screenplay' check (
    stage in ('screenplay', 'storyboard', 'video')
  ),
  status text not null default 'generating' check (
    status in (
      'generating',
      'awaiting_review',
      'revising',
      'rejected',
      'ready'
    )
  ),
  screenplay jsonb,
  storyboard jsonb,
  video jsonb,
  revision_feedback text,
  active_job_id uuid references public.job_runs (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creatives_workspace_created_idx
  on public.creatives (workspace_id, created_at desc);

create index if not exists creatives_product_idx
  on public.creatives (product_id, created_at desc);

create index if not exists creatives_status_idx
  on public.creatives (workspace_id, status);

create index if not exists creatives_campaign_idx
  on public.creatives (campaign_id)
  where campaign_id is not null;

alter table public.creatives enable row level security;

create policy "creatives_member_all" on public.creatives
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- Extend job_runs.type for creative generation stages.
alter table public.job_runs
  drop constraint if exists job_runs_type_check;

alter table public.job_runs
  add constraint job_runs_type_check check (
    type in (
      'create_campaign',
      'generate_creative_screenplay',
      'generate_creative_storyboard',
      'generate_creative_video'
    )
  );
