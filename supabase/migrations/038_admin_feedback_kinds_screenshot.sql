-- Broaden admin feedback kinds (bug / feature) and optional screenshot attachment.

alter table public.admin_feedback
  drop constraint if exists admin_feedback_kind_check;

alter table public.admin_feedback
  add constraint admin_feedback_kind_check
  check (kind in ('channel_request', 'bug', 'feature'));

alter table public.admin_feedback
  add column if not exists screenshot_url text;
