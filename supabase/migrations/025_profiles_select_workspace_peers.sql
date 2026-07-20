-- Allow workspace teammates to read each other's profile display fields
-- (email, full_name, avatar_url) via nested joins from workspace_members.

create or replace function public.shares_workspace_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members a
    join public.workspace_members b on a.workspace_id = b.workspace_id
    where a.user_id = auth.uid()
      and b.user_id = target_user_id
  );
$$;

create policy "profiles_select_workspace_peers" on public.profiles
  for select using (public.shares_workspace_with(id));
