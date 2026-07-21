-- Ensure API roles can reach job_runs, and recreate the member SELECT policy.
-- Writes remain service-role only (no INSERT/UPDATE/DELETE policies for members).

grant select on table public.job_runs to authenticated, anon, service_role;

drop policy if exists "job_runs_select_member" on public.job_runs;

create policy "job_runs_select_member" on public.job_runs
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));
