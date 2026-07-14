-- Product Agent initial schema
-- Apply in Supabase SQL editor or via CLI when credentials are configured.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  handle text not null,
  description text not null default '',
  status text not null check (status in ('draft', 'active', 'archived')),
  price numeric not null default 0,
  currency text not null default 'USD',
  images text[] not null default '{}',
  channels text[] not null default '{}',
  sku text,
  category text,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_owner_id_idx on public.products (owner_id);

create table if not exists public.product_intelligence (
  product_id text primary key references public.products (id) on delete cascade,
  positioning text not null default '',
  audience text not null default '',
  value_props text[] not null default '{}',
  objections text[] not null default '{}',
  tone text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.artifacts (
  id text primary key,
  product_id text not null references public.products (id) on delete cascade,
  type text not null check (type in ('positioning', 'ad_copy', 'campaign_concept', 'listing_update')),
  status text not null check (status in ('proposed', 'approved', 'rejected')),
  title text not null,
  summary text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists artifacts_product_id_idx on public.artifacts (product_id);

create table if not exists public.campaigns (
  id text primary key,
  product_id text not null references public.products (id) on delete cascade,
  name text not null,
  status text not null check (status in ('draft', 'active', 'paused')),
  channels text[] not null default '{}',
  objective text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists campaigns_product_id_idx on public.campaigns (product_id);

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_intelligence enable row level security;
alter table public.artifacts enable row level security;
alter table public.campaigns enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create policy "products_all_own" on public.products
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "intelligence_via_product" on public.product_intelligence
  for all using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.owner_id = auth.uid()
    )
  );

create policy "artifacts_via_product" on public.artifacts
  for all using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.owner_id = auth.uid()
    )
  );

create policy "campaigns_via_product" on public.campaigns
  for all using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.owner_id = auth.uid()
    )
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Optional storage bucket for product assets (create in dashboard if preferred):
-- insert into storage.buckets (id, name, public) values ('product-assets', 'product-assets', true);
