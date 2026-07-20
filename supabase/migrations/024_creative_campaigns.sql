-- Many-to-many campaign associations for video creatives and artifacts.

create table if not exists public.creative_campaigns (
  creative_id uuid not null references public.creatives (id) on delete cascade,
  campaign_id text not null references public.campaigns (id) on delete cascade,
  primary key (creative_id, campaign_id)
);

create index if not exists creative_campaigns_campaign_idx
  on public.creative_campaigns (campaign_id);

alter table public.creative_campaigns enable row level security;

create policy "creative_campaigns_via_creative" on public.creative_campaigns
  for all using (
    exists (
      select 1 from public.creatives c
      where c.id = creative_id and public.is_workspace_member(c.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.creatives c
      where c.id = creative_id and public.is_workspace_member(c.workspace_id)
    )
  );

create table if not exists public.artifact_campaigns (
  artifact_id text not null references public.artifacts (id) on delete cascade,
  campaign_id text not null references public.campaigns (id) on delete cascade,
  primary key (artifact_id, campaign_id)
);

create index if not exists artifact_campaigns_campaign_idx
  on public.artifact_campaigns (campaign_id);

alter table public.artifact_campaigns enable row level security;

create policy "artifact_campaigns_via_artifact" on public.artifact_campaigns
  for all using (
    exists (
      select 1 from public.artifacts a
      join public.products p on p.id = a.product_id
      where a.id = artifact_id and public.is_workspace_member(p.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.artifacts a
      join public.products p on p.id = a.product_id
      where a.id = artifact_id and public.is_workspace_member(p.workspace_id)
    )
  );

-- Backfill from legacy single campaign_id columns.
insert into public.creative_campaigns (creative_id, campaign_id)
select id, campaign_id
from public.creatives
where campaign_id is not null
on conflict do nothing;

insert into public.artifact_campaigns (artifact_id, campaign_id)
select id, campaign_id
from public.artifacts
where campaign_id is not null
on conflict do nothing;

-- Drop legacy columns and indexes.
drop index if exists public.creatives_campaign_idx;
alter table public.creatives drop column if exists campaign_id;

drop index if exists public.artifacts_campaign_id_idx;
drop index if exists public.artifacts_campaign_type_idx;
alter table public.artifacts drop column if exists campaign_id;
