-- Allow submitters to read back their own feedback rows.
-- PostgREST `.insert().select()` needs a SELECT policy; without it, non-admins
-- get "new row violates row-level security policy for table admin_feedback".

drop policy if exists "admin_feedback_select_own" on public.admin_feedback;

create policy "admin_feedback_select_own" on public.admin_feedback
  for select
  to authenticated
  using (auth.uid() = user_id);
