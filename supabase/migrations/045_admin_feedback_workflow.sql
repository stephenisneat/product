-- Feedback → prompt → Cursor cloud agent → PR → fulfillment email workflow.

alter table public.admin_feedback
  add column if not exists status text not null default 'pending',
  add column if not exists generated_prompt text,
  add column if not exists approved_prompt text,
  add column if not exists cursor_agent_id text,
  add column if not exists cursor_agent_url text,
  add column if not exists branch_name text,
  add column if not exists pr_url text,
  add column if not exists pr_number integer,
  add column if not exists agent_summary text,
  add column if not exists error_message text,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users (id) on delete set null,
  add column if not exists prompt_approved_at timestamptz,
  add column if not exists prompt_approved_by uuid references auth.users (id) on delete set null,
  add column if not exists agent_launched_at timestamptz,
  add column if not exists fulfilled_at timestamptz,
  add column if not exists fulfillment_email_sent_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejected_by uuid references auth.users (id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'admin_feedback_status_check'
  ) then
    alter table public.admin_feedback
      add constraint admin_feedback_status_check
      check (
        status in (
          'pending',
          'prompt_ready',
          'dispatched',
          'pr_open',
          'fulfilled',
          'rejected',
          'failed'
        )
      );
  end if;
end $$;

create index if not exists admin_feedback_status_idx
  on public.admin_feedback (status, created_at desc);

create index if not exists admin_feedback_cursor_agent_id_idx
  on public.admin_feedback (cursor_agent_id)
  where cursor_agent_id is not null;

create index if not exists admin_feedback_pr_url_idx
  on public.admin_feedback (pr_url)
  where pr_url is not null;

create index if not exists admin_feedback_pr_number_idx
  on public.admin_feedback (pr_number)
  where pr_number is not null;

drop policy if exists "admin_feedback_update_platform_admin" on public.admin_feedback;
create policy "admin_feedback_update_platform_admin" on public.admin_feedback
  for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
