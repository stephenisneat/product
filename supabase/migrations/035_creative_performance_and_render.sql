-- Creative review notifications, external ad refs, performance points,
-- and render_creative_video job type.

alter table public.notification_preferences
  add column if not exists creative_review boolean not null default true;

alter table public.creatives
  add column if not exists external_ad_refs jsonb not null default '{}'::jsonb;

create table if not exists public.creative_performance_points (
  creative_id uuid not null references public.creatives (id) on delete cascade,
  date date not null,
  impressions integer not null default 0,
  clicks integer not null default 0,
  spend numeric(12, 2) not null default 0,
  conversions numeric(12, 2) not null default 0,
  revenue numeric(12, 2) not null default 0,
  primary key (creative_id, date)
);

create index if not exists creative_performance_points_creative_id_idx
  on public.creative_performance_points (creative_id);

alter table public.creative_performance_points enable row level security;

create policy "creative_performance_select_workspace"
  on public.creative_performance_points
  for select
  using (
    exists (
      select 1
      from public.creatives c
      join public.workspace_members wm on wm.workspace_id = c.workspace_id
      where c.id = creative_performance_points.creative_id
        and wm.user_id = auth.uid()
    )
  );

-- Extend job_runs.type for Remotion re-export after clip edits.
alter table public.job_runs
  drop constraint if exists job_runs_type_check;

alter table public.job_runs
  add constraint job_runs_type_check check (
    type in (
      'create_campaign',
      'generate_creative_screenplay',
      'generate_creative_storyboard',
      'generate_creative_video',
      'render_creative_video',
      'generate_insight'
    )
  );
