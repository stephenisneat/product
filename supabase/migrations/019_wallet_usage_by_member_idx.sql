-- Speed up MTD AI usage rollups grouped by member (created_by).
create index if not exists wallet_transactions_ai_usage_mtd_idx
  on public.wallet_transactions (workspace_id, created_at desc)
  where type = 'ai_usage';
