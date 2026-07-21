-- Product Plugin — GTM-style tag containers (one per workspace).

create table if not exists public.plugin_containers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  published_version int not null default 0,
  draft_version int not null default 1,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id)
);

create index if not exists plugin_containers_workspace_idx
  on public.plugin_containers (workspace_id);

create table if not exists public.plugin_container_tags (
  id uuid primary key default gen_random_uuid(),
  container_id uuid not null references public.plugin_containers (id) on delete cascade,
  name text not null,
  type text not null check (type in ('pixel', 'script', 'custom_html', 'builtin')),
  config jsonb not null default '{}'::jsonb,
  trigger_ids uuid[] not null default '{}',
  priority int not null default 0,
  enabled boolean not null default true,
  consent_category text not null default 'necessary'
    check (consent_category in ('necessary', 'analytics', 'marketing', 'preferences')),
  rate_limit_exempt boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plugin_container_tags_container_idx
  on public.plugin_container_tags (container_id);

create table if not exists public.plugin_container_triggers (
  id uuid primary key default gen_random_uuid(),
  container_id uuid not null references public.plugin_containers (id) on delete cascade,
  name text not null,
  type text not null check (type in (
    'pageview', 'click', 'custom_event', 'timer',
    'scroll_depth', 'form_submit', 'element_visible'
  )),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plugin_container_triggers_container_idx
  on public.plugin_container_triggers (container_id);

create table if not exists public.plugin_container_variables (
  id uuid primary key default gen_random_uuid(),
  container_id uuid not null references public.plugin_containers (id) on delete cascade,
  name text not null,
  type text not null check (type in (
    'constant', 'data_layer', 'cookie', 'dom_element',
    'javascript', 'url_parameter', 'builtin'
  )),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plugin_container_variables_container_idx
  on public.plugin_container_variables (container_id);

create table if not exists public.plugin_container_versions (
  id uuid primary key default gen_random_uuid(),
  container_id uuid not null references public.plugin_containers (id) on delete cascade,
  version int not null,
  snapshot jsonb not null,
  published_by uuid references auth.users (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  unique (container_id, version)
);

create index if not exists plugin_container_versions_container_idx
  on public.plugin_container_versions (container_id, version desc);

create table if not exists public.plugin_measurement_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  event_type text not null,
  event_name text,
  tag_id uuid references public.plugin_container_tags (id) on delete set null,
  url text,
  referrer text,
  user_agent text,
  ip_address inet,
  session_id text,
  visitor_id text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists plugin_measurement_events_workspace_idx
  on public.plugin_measurement_events (workspace_id, created_at desc);

create index if not exists plugin_measurement_events_type_idx
  on public.plugin_measurement_events (event_type, created_at desc);

-- RLS
alter table public.plugin_containers enable row level security;
alter table public.plugin_container_tags enable row level security;
alter table public.plugin_container_triggers enable row level security;
alter table public.plugin_container_variables enable row level security;
alter table public.plugin_container_versions enable row level security;
alter table public.plugin_measurement_events enable row level security;

create policy "plugin_containers_member_all" on public.plugin_containers
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "plugin_container_tags_member_all" on public.plugin_container_tags
  for all using (
    container_id in (
      select id from public.plugin_containers
      where public.is_workspace_member(workspace_id)
    )
  )
  with check (
    container_id in (
      select id from public.plugin_containers
      where public.is_workspace_member(workspace_id)
    )
  );

create policy "plugin_container_triggers_member_all" on public.plugin_container_triggers
  for all using (
    container_id in (
      select id from public.plugin_containers
      where public.is_workspace_member(workspace_id)
    )
  )
  with check (
    container_id in (
      select id from public.plugin_containers
      where public.is_workspace_member(workspace_id)
    )
  );

create policy "plugin_container_variables_member_all" on public.plugin_container_variables
  for all using (
    container_id in (
      select id from public.plugin_containers
      where public.is_workspace_member(workspace_id)
    )
  )
  with check (
    container_id in (
      select id from public.plugin_containers
      where public.is_workspace_member(workspace_id)
    )
  );

create policy "plugin_container_versions_member_all" on public.plugin_container_versions
  for all using (
    container_id in (
      select id from public.plugin_containers
      where public.is_workspace_member(workspace_id)
    )
  )
  with check (
    container_id in (
      select id from public.plugin_containers
      where public.is_workspace_member(workspace_id)
    )
  );

create policy "plugin_measurement_events_member_all" on public.plugin_measurement_events
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- Atomic publish: lock container, insert next version, bump counters.
create or replace function public.publish_plugin_container_snapshot_version(
  p_container_id uuid,
  p_snapshot jsonb,
  p_notes text default null,
  p_published_by uuid default null
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version int;
begin
  perform 1
    from public.plugin_containers pc
    where pc.id = p_container_id
    for update;

  if not found then
    raise exception 'plugin container not found: %', p_container_id;
  end if;

  insert into public.plugin_container_versions (
    container_id,
    version,
    snapshot,
    notes,
    published_by
  )
  select
    p_container_id,
    coalesce(max(pcv.version), 0) + 1,
    p_snapshot || jsonb_build_object('version', coalesce(max(pcv.version), 0) + 1),
    p_notes,
    p_published_by
  from public.plugin_container_versions pcv
  where pcv.container_id = p_container_id
  returning version into v_version;

  update public.plugin_containers
    set published_version = v_version,
        draft_version = v_version + 1,
        published_at = now(),
        updated_at = now()
    where id = p_container_id;

  return v_version;
end;
$$;

revoke all on function public.publish_plugin_container_snapshot_version(uuid, jsonb, text, uuid) from public;
grant execute on function public.publish_plugin_container_snapshot_version(uuid, jsonb, text, uuid) to authenticated;
grant execute on function public.publish_plugin_container_snapshot_version(uuid, jsonb, text, uuid) to service_role;
