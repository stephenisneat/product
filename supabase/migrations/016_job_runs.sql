-- Background job runs (Trigger.dev-backed). Members can read; writes via service role.

create table if not exists public.job_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  product_id text references public.products (id) on delete set null,
  type text not null check (type in ('create_campaign')),
  status text not null default 'pending' check (
    status in ('pending', 'running', 'succeeded', 'failed', 'canceled')
  ),
  trigger_source text not null check (
    trigger_source in ('agent', 'api', 'cron', 'event')
  ),
  trigger_run_id text,
  created_by uuid references auth.users (id) on delete set null,
  input jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists job_runs_workspace_created_idx
  on public.job_runs (workspace_id, created_at desc);

create index if not exists job_runs_product_created_idx
  on public.job_runs (product_id, created_at desc)
  where product_id is not null;

alter table public.job_runs enable row level security;

create policy "job_runs_select_member" on public.job_runs
  for select using (public.is_workspace_member(workspace_id));
