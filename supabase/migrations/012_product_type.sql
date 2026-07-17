alter table public.products
  add column if not exists type text not null default 'ecommerce';

alter table public.products
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.products
  drop constraint if exists products_type_check;

alter table public.products
  add constraint products_type_check
  check (
    type in (
      'ecommerce',
      'mobile_app',
      'website',
      'brick_and_mortar',
      'event',
      'election'
    )
  );

update public.products
set metadata = '{"fulfillmentKind":"physical"}'::jsonb
where type = 'ecommerce'
  and (metadata = '{}'::jsonb or metadata is null);
