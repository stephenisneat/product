-- Search ad creatives: copy → keywords stages, payloads, and job types.

alter table public.creatives
  drop constraint if exists creatives_kind_check;

alter table public.creatives
  add constraint creatives_kind_check check (
    kind in ('video_ad', 'display_ad', 'search_ad')
  );

alter table public.creatives
  drop constraint if exists creatives_stage_check;

alter table public.creatives
  add constraint creatives_stage_check check (
    stage in (
      'screenplay',
      'storyboard',
      'video',
      'concept',
      'assets',
      'copy',
      'keywords'
    )
  );

alter table public.creatives
  add column if not exists copy jsonb;

alter table public.creatives
  add column if not exists keywords jsonb;

alter table public.job_runs
  drop constraint if exists job_runs_type_check;

alter table public.job_runs
  add constraint job_runs_type_check check (
    type in (
      'create_campaign',
      'generate_creative_screenplay',
      'generate_creative_storyboard',
      'generate_creative_video',
      'generate_creative_concept',
      'generate_creative_assets',
      'generate_creative_copy',
      'generate_creative_keywords',
      'render_creative_video',
      'generate_insight',
      'sync_ad_performance'
    )
  );
