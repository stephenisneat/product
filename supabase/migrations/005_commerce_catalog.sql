-- Commerce catalog: connections, variants/options, inventory, collections, source tracking.

alter table public.products
  add column if not exists source_provider text,
  add column if not exists source_product_id text;

create unique index if not exists products_owner_source_uidx
  on public.products (owner_id, source_provider, source_product_id)
  where source_provider is not null and source_product_id is not null;

create table if not exists public.commerce_connections (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('shopify')),
  shop_domain text not null,
  access_token text not null,
  scope text not null default '',
  status text not null default 'active' check (status in ('active', 'disconnected', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, provider, shop_domain)
);

create index if not exists commerce_connections_owner_id_idx
  on public.commerce_connections (owner_id);

create table if not exists public.product_options (
  id text primary key,
  product_id text not null references public.products (id) on delete cascade,
  name text not null,
  position integer not null default 0
);

create index if not exists product_options_product_id_idx
  on public.product_options (product_id);

create table if not exists public.product_variants (
  id text primary key,
  product_id text not null references public.products (id) on delete cascade,
  title text not null default 'Default Title',
  sku text,
  barcode text,
  price numeric not null default 0,
  compare_at_price numeric,
  currency text not null default 'USD',
  option_values jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  source_variant_id text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_variants_product_id_idx
  on public.product_variants (product_id);

create unique index if not exists product_variants_source_uidx
  on public.product_variants (product_id, source_variant_id)
  where source_variant_id is not null;

create table if not exists public.inventory_levels (
  variant_id text primary key references public.product_variants (id) on delete cascade,
  quantity integer not null default 0,
  tracked boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.collections (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  handle text not null,
  source_provider text,
  source_collection_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists collections_owner_id_idx on public.collections (owner_id);

create unique index if not exists collections_owner_source_uidx
  on public.collections (owner_id, source_provider, source_collection_id)
  where source_provider is not null and source_collection_id is not null;

create table if not exists public.product_collections (
  product_id text not null references public.products (id) on delete cascade,
  collection_id text not null references public.collections (id) on delete cascade,
  primary key (product_id, collection_id)
);

create index if not exists product_collections_collection_id_idx
  on public.product_collections (collection_id);

alter table public.commerce_connections enable row level security;
alter table public.product_options enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory_levels enable row level security;
alter table public.collections enable row level security;
alter table public.product_collections enable row level security;

create policy "commerce_connections_all_own" on public.commerce_connections
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "product_options_via_product" on public.product_options
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

create policy "product_variants_via_product" on public.product_variants
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

create policy "inventory_levels_via_variant" on public.inventory_levels
  for all using (
    exists (
      select 1
      from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = variant_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = variant_id and p.owner_id = auth.uid()
    )
  );

create policy "collections_all_own" on public.collections
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "product_collections_via_product" on public.product_collections
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
