-- Allow creatives to be paused while generation is stopped (pause UI / Trigger cancel).

alter table public.creatives
  drop constraint if exists creatives_status_check;

alter table public.creatives
  add constraint creatives_status_check check (
    status in (
      'generating',
      'awaiting_review',
      'revising',
      'paused',
      'rejected',
      'ready'
    )
  );
