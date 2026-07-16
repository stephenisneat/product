-- Workspace settings: avatar, plan, domain join, storage, discovery RPCs.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

alter table public.workspaces
  add column if not exists avatar_url text,
  add column if not exists plan text not null default 'free',
  add column if not exists join_domain text,
  add column if not exists domain_join_enabled boolean not null default false;

alter table public.workspaces
  drop constraint if exists workspaces_plan_check;

alter table public.workspaces
  add constraint workspaces_plan_check
  check (plan in ('free', 'pro'));

create index if not exists workspaces_join_domain_idx
  on public.workspaces (lower(join_domain))
  where domain_join_enabled = true and join_domain is not null;

-- Owners and admins may update workspace settings (API enforces plan/domain = owner).
drop policy if exists "workspaces_update_owner" on public.workspaces;
create policy "workspaces_update_owner_admin" on public.workspaces
  for update using (public.has_workspace_role(id, array['owner', 'admin']));

-- ---------------------------------------------------------------------------
-- Discoverable workspaces + domain join (security definer)
-- ---------------------------------------------------------------------------

create or replace function public.list_discoverable_workspaces()
returns setof public.workspaces
language sql
stable
security definer
set search_path = public
as $$
  select w.*
  from public.workspaces w
  join public.profiles p on p.id = auth.uid()
  where w.domain_join_enabled = true
    and w.join_domain is not null
    and lower(w.join_domain) = lower(split_part(coalesce(p.email, ''), '@', 2))
    and not exists (
      select 1
      from public.workspace_members m
      where m.workspace_id = w.id
        and m.user_id = auth.uid()
    );
$$;

revoke all on function public.list_discoverable_workspaces() from public;
grant execute on function public.list_discoverable_workspaces() to authenticated;

create or replace function public.join_workspace_by_domain(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  user_domain text;
  ws_domain text;
  ws_enabled boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select lower(split_part(coalesce(email, ''), '@', 2))
  into user_domain
  from public.profiles
  where id = auth.uid();

  if user_domain is null or user_domain = '' then
    raise exception 'No email domain on profile';
  end if;

  select lower(join_domain), domain_join_enabled
  into ws_domain, ws_enabled
  from public.workspaces
  where id = p_workspace_id;

  if ws_domain is null then
    raise exception 'Workspace not found';
  end if;

  if not ws_enabled or ws_domain is distinct from user_domain then
    raise exception 'Domain join not allowed';
  end if;

  if exists (
    select 1
    from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
  ) then
    return;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (p_workspace_id, auth.uid(), 'member');
end;
$$;

revoke all on function public.join_workspace_by_domain(uuid) from public;
grant execute on function public.join_workspace_by_domain(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: workspace-assets
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('workspace-assets', 'workspace-assets', true)
on conflict (id) do nothing;

create policy "workspace_assets_insert_admin"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'workspace-assets'
  and public.has_workspace_role(
    ((storage.foldername(name))[1])::uuid,
    array['owner', 'admin']
  )
);

create policy "workspace_assets_update_admin"
on storage.objects for update
to authenticated
using (
  bucket_id = 'workspace-assets'
  and public.has_workspace_role(
    ((storage.foldername(name))[1])::uuid,
    array['owner', 'admin']
  )
)
with check (
  bucket_id = 'workspace-assets'
  and public.has_workspace_role(
    ((storage.foldername(name))[1])::uuid,
    array['owner', 'admin']
  )
);

create policy "workspace_assets_delete_admin"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'workspace-assets'
  and public.has_workspace_role(
    ((storage.foldername(name))[1])::uuid,
    array['owner', 'admin']
  )
);

create policy "workspace_assets_select_public"
on storage.objects for select
to public
using (bucket_id = 'workspace-assets');
