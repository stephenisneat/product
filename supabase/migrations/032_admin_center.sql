-- Internal Admin Center: platform-admin flag + feedback inbox.
-- Grant access manually (no self-serve UI):
--   update public.profiles set is_platform_admin = true where email = 'you@example.com';

alter table public.profiles
  add column if not exists is_platform_admin boolean not null default false;

-- Prevent authenticated users from elevating themselves via profiles_update_own.
create or replace function public.protect_is_platform_admin()
returns trigger
language plpgsql
as $$
begin
  if new.is_platform_admin is distinct from old.is_platform_admin
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Cannot modify is_platform_admin';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_is_platform_admin on public.profiles;
create trigger profiles_protect_is_platform_admin
  before update on public.profiles
  for each row
  execute function public.protect_is_platform_admin();

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.is_platform_admin
      from public.profiles p
      where p.id = auth.uid()
    ),
    false
  );
$$;

create table if not exists public.admin_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  user_email text,
  kind text not null check (kind in ('channel_request')),
  title text not null,
  body text,
  created_at timestamptz not null default now()
);

create index if not exists admin_feedback_created_at_idx
  on public.admin_feedback (created_at desc);

alter table public.admin_feedback enable row level security;

grant select, insert, update, delete on table public.admin_feedback
  to anon, authenticated, service_role;

drop policy if exists "admin_feedback_insert_own" on public.admin_feedback;
create policy "admin_feedback_insert_own" on public.admin_feedback
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "admin_feedback_select_platform_admin" on public.admin_feedback;
create policy "admin_feedback_select_platform_admin" on public.admin_feedback
  for select
  to authenticated
  using (public.is_platform_admin());
