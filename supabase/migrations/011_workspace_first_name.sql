-- Default workspace names use the user's first name only
-- (e.g. "Stephen's Workspace" instead of "Stephen Kennedy's Workspace").

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
  ws_name text;
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );

  ws_name := coalesce(
    nullif(
      split_part(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ' ', 1),
      ''
    ),
    split_part(coalesce(new.email, ''), '@', 1),
    'My'
  );

  insert into public.workspaces (name, created_by)
  values (ws_name || '''s Workspace', new.id)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, new.id, 'owner');

  update public.profiles
  set active_workspace_id = ws_id
  where id = new.id;

  return new;
end;
$$;

-- Rename existing default workspaces that still use the full name.
update public.workspaces w
set name = split_part(trim(p.full_name), ' ', 1) || '''s Workspace'
from public.profiles p
where w.created_by = p.id
  and nullif(trim(p.full_name), '') is not null
  and position(' ' in trim(p.full_name)) > 0
  and w.name = trim(p.full_name) || '''s Workspace';
