-- Multi-plugin workspaces: many containers per workspace, keyed by plugin id.

-- Nobody is using this yet; clear any local rows so NOT NULL columns apply cleanly.
truncate table public.plugin_measurement_events;
truncate table public.plugin_containers cascade;

alter table public.plugin_containers
  drop constraint if exists plugin_containers_workspace_id_key;

alter table public.plugin_containers
  add column if not exists name text,
  add column if not exists platform text,
  add column if not exists domain text;

update public.plugin_containers
  set name = coalesce(nullif(trim(name), ''), 'Plugin'),
      platform = coalesce(nullif(trim(platform), ''), 'custom')
  where name is null or platform is null;

alter table public.plugin_containers
  alter column name set not null,
  alter column platform set not null;

alter table public.plugin_containers
  drop constraint if exists plugin_containers_platform_check;

alter table public.plugin_containers
  add constraint plugin_containers_platform_check
  check (platform in (
    'nextjs',
    'shopify',
    'bigcommerce',
    'woocommerce',
    'squarespace',
    'amazon',
    'ios',
    'android',
    'custom'
  ));

alter table public.plugin_measurement_events
  add column if not exists plugin_id uuid
    references public.plugin_containers (id) on delete set null;

create index if not exists plugin_measurement_events_plugin_idx
  on public.plugin_measurement_events (plugin_id, created_at desc);

comment on column public.plugin_containers.name is
  'Display name for this plugin install (e.g. Shopify store, iOS app).';
comment on column public.plugin_containers.platform is
  'Install / runtime surface that drives snippet instructions.';
comment on column public.plugin_containers.domain is
  'Optional domain or surface label shown in the install UI.';
