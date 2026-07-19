-- Rename Hobby → Growth plan (display + internal id).

update public.workspaces
set plan = 'growth'
where plan = 'hobby';

alter table public.workspaces
  drop constraint if exists workspaces_plan_check;

alter table public.workspaces
  add constraint workspaces_plan_check
    check (plan in ('free', 'growth', 'pro'));
