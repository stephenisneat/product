-- Parallel array of average hex colors for products.images (same index order).
alter table public.products
  add column if not exists image_avg_colors text[] not null default '{}';
