-- Expand ad_connections providers beyond Google Ads.

alter table public.ad_connections
  drop constraint if exists ad_connections_provider_check;

alter table public.ad_connections
  add constraint ad_connections_provider_check
  check (provider in ('google', 'meta', 'tiktok', 'amazon', 'x'));
