-- Multi-tenant workspaces: tables, backfill from owner_id, signup default, RLS.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_id_idx
  on public.workspace_members (user_id);

-- Allow PostgREST joins to profiles (profiles.id = auth.users.id)
alter table public.workspace_members
  add constraint workspace_members_user_id_profiles_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

-- Exactly one owner per workspace
create unique index if not exists workspace_members_one_owner_uidx
  on public.workspace_members (workspace_id)
  where role = 'owner';

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'member')),
  token text not null unique,
  invited_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists workspace_invites_workspace_id_idx
  on public.workspace_invites (workspace_id);

create index if not exists workspace_invites_token_idx
  on public.workspace_invites (token);

create unique index if not exists workspace_invites_pending_email_uidx
  on public.workspace_invites (workspace_id, lower(email))
  where accepted_at is null;

alter table public.profiles
  add column if not exists active_workspace_id uuid references public.workspaces (id) on delete set null;

-- ---------------------------------------------------------------------------
-- RLS helpers (security definer to avoid recursion)
-- ---------------------------------------------------------------------------

create or replace function public.is_workspace_member(ws_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = ws_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_workspace_role(ws_id uuid, roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = ws_id
      and m.user_id = auth.uid()
      and m.role = any (roles)
  );
$$;

-- ---------------------------------------------------------------------------
-- Add workspace_id columns (nullable until backfill)
-- ---------------------------------------------------------------------------

alter table public.products
  add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;

alter table public.collections
  add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;

alter table public.commerce_connections
  add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- Backfill: one workspace per existing owner
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
  ws_id uuid;
  ws_name text;
begin
  -- Owners who already have products, collections, or connections
  for r in
    select distinct owner_id as user_id
    from (
      select owner_id from public.products
      union
      select owner_id from public.collections
      union
      select owner_id from public.commerce_connections
    ) owners
  loop
    select coalesce(
      nullif(trim(p.full_name), ''),
      split_part(coalesce(p.email, ''), '@', 1),
      'My'
    )
    into ws_name
    from public.profiles p
    where p.id = r.user_id;

    if ws_name is null or ws_name = '' then
      ws_name := 'My';
    end if;

    insert into public.workspaces (name, created_by)
    values (ws_name || '''s Workspace', r.user_id)
    returning id into ws_id;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (ws_id, r.user_id, 'owner')
    on conflict do nothing;

    update public.products
    set workspace_id = ws_id
    where owner_id = r.user_id and workspace_id is null;

    update public.collections
    set workspace_id = ws_id
    where owner_id = r.user_id and workspace_id is null;

    update public.commerce_connections
    set workspace_id = ws_id
    where owner_id = r.user_id and workspace_id is null;

    update public.profiles
    set active_workspace_id = ws_id
    where id = r.user_id and active_workspace_id is null;
  end loop;

  -- Profiles with no owned data yet still get a default workspace
  for r in
    select p.id as user_id, p.full_name, p.email
    from public.profiles p
    where not exists (
      select 1 from public.workspace_members m where m.user_id = p.id
    )
  loop
    ws_name := coalesce(
      nullif(trim(r.full_name), ''),
      split_part(coalesce(r.email, ''), '@', 1),
      'My'
    );

    insert into public.workspaces (name, created_by)
    values (ws_name || '''s Workspace', r.user_id)
    returning id into ws_id;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (ws_id, r.user_id, 'owner');

    update public.profiles
    set active_workspace_id = ws_id
    where id = r.user_id;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cut over: drop owner_id, enforce workspace_id NOT NULL
-- ---------------------------------------------------------------------------

-- Drop old policies that reference owner_id
drop policy if exists "products_all_own" on public.products;
drop policy if exists "intelligence_via_product" on public.product_intelligence;
drop policy if exists "artifacts_via_product" on public.artifacts;
drop policy if exists "campaigns_via_product" on public.campaigns;
drop policy if exists "commerce_connections_all_own" on public.commerce_connections;
drop policy if exists "product_options_via_product" on public.product_options;
drop policy if exists "product_variants_via_product" on public.product_variants;
drop policy if exists "inventory_levels_via_variant" on public.inventory_levels;
drop policy if exists "collections_all_own" on public.collections;
drop policy if exists "product_collections_via_product" on public.product_collections;

drop index if exists products_owner_id_idx;
drop index if exists products_owner_source_uidx;
drop index if exists collections_owner_id_idx;
drop index if exists collections_owner_source_uidx;
drop index if exists commerce_connections_owner_id_idx;

-- Drop unique constraints that include owner_id (name may vary by PG version)
alter table public.commerce_connections
  drop constraint if exists commerce_connections_owner_id_provider_shop_domain_key;

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.commerce_connections'::regclass
    and contype = 'u'
    and pg_get_constraintdef(oid) ilike '%owner_id%';
  if cname is not null then
    execute format('alter table public.commerce_connections drop constraint %I', cname);
  end if;
end;
$$;

alter table public.products drop column if exists owner_id;
alter table public.collections drop column if exists owner_id;
alter table public.commerce_connections drop column if exists owner_id;


alter table public.products
  alter column workspace_id set not null;

alter table public.collections
  alter column workspace_id set not null;

alter table public.commerce_connections
  alter column workspace_id set not null;

create index if not exists products_workspace_id_idx
  on public.products (workspace_id);

create unique index if not exists products_workspace_source_uidx
  on public.products (workspace_id, source_provider, source_product_id)
  where source_provider is not null and source_product_id is not null;

create index if not exists collections_workspace_id_idx
  on public.collections (workspace_id);

create unique index if not exists collections_workspace_source_uidx
  on public.collections (workspace_id, source_provider, source_collection_id)
  where source_provider is not null and source_collection_id is not null;

create index if not exists commerce_connections_workspace_id_idx
  on public.commerce_connections (workspace_id);

alter table public.commerce_connections
  add constraint commerce_connections_workspace_provider_shop_uidx
  unique (workspace_id, provider, shop_domain);

-- ---------------------------------------------------------------------------
-- Signup: create profile + default workspace
-- ---------------------------------------------------------------------------

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
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
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

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;

-- Workspaces
create policy "workspaces_select_member" on public.workspaces
  for select using (public.is_workspace_member(id));

create policy "workspaces_insert_authenticated" on public.workspaces
  for insert with check (auth.uid() = created_by);

create policy "workspaces_update_owner" on public.workspaces
  for update using (public.has_workspace_role(id, array['owner']));

create policy "workspaces_delete_owner" on public.workspaces
  for delete using (public.has_workspace_role(id, array['owner']));

-- Members
create policy "workspace_members_select" on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));

create policy "workspace_members_insert_admin" on public.workspace_members
  for insert with check (
    public.has_workspace_role(workspace_id, array['owner', 'admin'])
    or (
      -- Allow creator to add themselves as owner on workspace create
      role = 'owner'
      and user_id = auth.uid()
      and exists (
        select 1 from public.workspaces w
        where w.id = workspace_id and w.created_by = auth.uid()
      )
    )
  );

create policy "workspace_members_update_admin" on public.workspace_members
  for update using (
    public.has_workspace_role(workspace_id, array['owner', 'admin'])
  );

create policy "workspace_members_delete_admin" on public.workspace_members
  for delete using (
    public.has_workspace_role(workspace_id, array['owner', 'admin'])
    or user_id = auth.uid()
  );

-- Invites
create policy "workspace_invites_select_member" on public.workspace_invites
  for select using (public.is_workspace_member(workspace_id));

-- Allow invitee to look up invite by being authenticated (accept flow uses token via API)
-- Token lookup for accept is done server-side; members see invites for their workspace.
create policy "workspace_invites_insert_admin" on public.workspace_invites
  for insert with check (
    public.has_workspace_role(workspace_id, array['owner', 'admin'])
  );

create policy "workspace_invites_update_admin" on public.workspace_invites
  for update using (
    public.has_workspace_role(workspace_id, array['owner', 'admin'])
  );

create policy "workspace_invites_delete_admin" on public.workspace_invites
  for delete using (
    public.has_workspace_role(workspace_id, array['owner', 'admin'])
  );

-- Products & related (membership via workspace_id)
create policy "products_member_all" on public.products
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "intelligence_via_product" on public.product_intelligence
  for all using (
    exists (
      select 1 from public.products p
      where p.id = product_id and public.is_workspace_member(p.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_id and public.is_workspace_member(p.workspace_id)
    )
  );

create policy "artifacts_via_product" on public.artifacts
  for all using (
    exists (
      select 1 from public.products p
      where p.id = product_id and public.is_workspace_member(p.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_id and public.is_workspace_member(p.workspace_id)
    )
  );

create policy "campaigns_via_product" on public.campaigns
  for all using (
    exists (
      select 1 from public.products p
      where p.id = product_id and public.is_workspace_member(p.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_id and public.is_workspace_member(p.workspace_id)
    )
  );

create policy "commerce_connections_member_all" on public.commerce_connections
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "collections_member_all" on public.collections
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "product_options_via_product" on public.product_options
  for all using (
    exists (
      select 1 from public.products p
      where p.id = product_id and public.is_workspace_member(p.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_id and public.is_workspace_member(p.workspace_id)
    )
  );

create policy "product_variants_via_product" on public.product_variants
  for all using (
    exists (
      select 1 from public.products p
      where p.id = product_id and public.is_workspace_member(p.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_id and public.is_workspace_member(p.workspace_id)
    )
  );

create policy "inventory_levels_via_variant" on public.inventory_levels
  for all using (
    exists (
      select 1
      from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = variant_id and public.is_workspace_member(p.workspace_id)
    )
  )
  with check (
    exists (
      select 1
      from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = variant_id and public.is_workspace_member(p.workspace_id)
    )
  );

create policy "product_collections_via_product" on public.product_collections
  for all using (
    exists (
      select 1 from public.products p
      where p.id = product_id and public.is_workspace_member(p.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_id and public.is_workspace_member(p.workspace_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Invite RPCs (token lookup + accept without prior membership)
-- ---------------------------------------------------------------------------

create or replace function public.peek_workspace_invite(p_token text)
returns table (
  id uuid,
  workspace_id uuid,
  workspace_name text,
  email text,
  role text,
  expires_at timestamptz,
  accepted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    i.id,
    i.workspace_id,
    w.name as workspace_name,
    i.email,
    i.role,
    i.expires_at,
    i.accepted_at
  from public.workspace_invites i
  join public.workspaces w on w.id = i.workspace_id
  where i.token = p_token;
end;
$$;

create or replace function public.accept_workspace_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.workspace_invites%rowtype;
  user_email text;
  now_ts timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into invite_row
  from public.workspace_invites
  where token = p_token
  for update;

  if not found then
    raise exception 'Invite not found';
  end if;

  if invite_row.accepted_at is not null then
    raise exception 'Invite already accepted';
  end if;

  if invite_row.expires_at < now_ts then
    raise exception 'Invite expired';
  end if;

  select email into user_email from public.profiles where id = auth.uid();
  if user_email is null or lower(user_email) <> lower(invite_row.email) then
    raise exception 'Invite email does not match signed-in user';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, created_at)
  values (invite_row.workspace_id, auth.uid(), invite_row.role, now_ts)
  on conflict (workspace_id, user_id) do update
    set role = excluded.role;

  update public.workspace_invites
  set accepted_at = now_ts
  where id = invite_row.id;

  update public.profiles
  set active_workspace_id = invite_row.workspace_id
  where id = auth.uid();

  return invite_row.workspace_id;
end;
$$;

grant execute on function public.peek_workspace_invite(text) to authenticated, anon;
grant execute on function public.accept_workspace_invite(text) to authenticated;
