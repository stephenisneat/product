-- Workspace primary domain (brand/site domain for plugin and related features).

alter table public.workspaces
  add column if not exists primary_domain text;

create index if not exists workspaces_primary_domain_idx
  on public.workspaces (lower(primary_domain))
  where primary_domain is not null;
