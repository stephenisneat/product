-- Per-workspace insight settings: goal mode, triggers, heartbeat schedule.

create table if not exists public.workspace_insight_settings (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  goal_mode text not null default 'auto'
    check (goal_mode in ('auto', 'manual')),
  trigger_job boolean not null default true,
  trigger_agent boolean not null default true,
  trigger_heartbeat boolean not null default true,
  trigger_api boolean not null default true,
  heartbeat_schedule text not null default 'daily'
    check (heartbeat_schedule in ('daily', 'weekly', 'off')),
  updated_at timestamptz not null default now()
);

alter table public.workspace_insight_settings enable row level security;

create policy "workspace_insight_settings_select_member"
  on public.workspace_insight_settings
  for select
  using (public.has_workspace_role(workspace_id, array['owner', 'admin', 'member']));

create policy "workspace_insight_settings_insert_admin"
  on public.workspace_insight_settings
  for insert
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "workspace_insight_settings_update_admin"
  on public.workspace_insight_settings
  for update
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']))
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin']));
