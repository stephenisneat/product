-- Insight kind: what the insight is (section groups), separate from workflow status.

alter table public.insights
  add column if not exists kind text not null default 'idea';

alter table public.insights
  drop constraint if exists insights_kind_check;

alter table public.insights
  add constraint insights_kind_check
  check (kind in ('blocker', 'opportunity', 'idea', 'setup'));

comment on column public.insights.kind is
  'Content nature for list grouping: blocker | opportunity | idea | setup';
