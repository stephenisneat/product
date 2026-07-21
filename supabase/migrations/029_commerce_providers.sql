-- Expand commerce_connections.provider to support additional ecommerce platforms.

alter table public.commerce_connections
  drop constraint if exists commerce_connections_provider_check;

alter table public.commerce_connections
  add constraint commerce_connections_provider_check
  check (
    provider in (
      'shopify',
      'woocommerce',
      'bigcommerce',
      'amazon',
      'squarespace'
    )
  );
