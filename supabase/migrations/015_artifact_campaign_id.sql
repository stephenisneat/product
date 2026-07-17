-- Link creatives (ad_copy artifacts) to campaigns for per-campaign plan limits.

alter table public.artifacts
  add column if not exists campaign_id text references public.campaigns (id) on delete set null;

create index if not exists artifacts_campaign_id_idx
  on public.artifacts (campaign_id)
  where campaign_id is not null;

create index if not exists artifacts_campaign_type_idx
  on public.artifacts (campaign_id, type)
  where campaign_id is not null;
