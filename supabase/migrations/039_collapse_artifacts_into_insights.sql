-- Collapse artifacts into insights: backfill deliverables, then drop artifacts.

-- Convert any existing propose_artifact actions to apply_deliverable.
update public.insights
set action = jsonb_set(action, '{type}', '"apply_deliverable"')
where action is not null
  and action->>'type' = 'propose_artifact';

-- Backfill each artifact as an insight with an apply_deliverable action.
insert into public.insights (
  workspace_id,
  product_id,
  title,
  summary,
  rationale,
  status,
  trigger_source,
  trigger_ref,
  action,
  created_by,
  created_at,
  updated_at
)
select
  p.workspace_id,
  a.product_id,
  a.title,
  a.summary,
  '',
  case a.status
    when 'proposed' then 'awaiting_review'
    when 'approved' then 'accepted'
    when 'rejected' then 'rejected'
    else 'awaiting_review'
  end,
  'agent',
  jsonb_build_object('migratedFromArtifactId', a.id),
  jsonb_build_object(
    'type', 'apply_deliverable',
    'label', case a.type
      when 'positioning' then 'Apply positioning'
      when 'ad_copy' then 'Apply ad copy'
      when 'campaign_concept' then 'Apply campaign concept'
      when 'listing_update' then 'Apply listing update'
      else 'Apply deliverable'
    end,
    'payload', jsonb_build_object(
      'productId', a.product_id,
      'type', a.type,
      'title', a.title,
      'summary', a.summary,
      'campaignIds', coalesce(
        (
          select jsonb_agg(ac.campaign_id order by ac.campaign_id)
          from public.artifact_campaigns ac
          where ac.artifact_id = a.id
        ),
        '[]'::jsonb
      ),
      'payload', a.payload
    )
  ),
  case
    when a.created_by ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then a.created_by::uuid
    else null
  end,
  a.created_at,
  a.updated_at
from public.artifacts a
join public.products p on p.id = a.product_id
where p.workspace_id is not null
  and not exists (
    select 1
    from public.insights i
    where i.trigger_ref->>'migratedFromArtifactId' = a.id
  );

drop policy if exists "artifact_campaigns_via_artifact" on public.artifact_campaigns;
drop table if exists public.artifact_campaigns;

drop policy if exists "artifacts_via_product" on public.artifacts;
drop table if exists public.artifacts;
