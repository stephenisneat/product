-- Workspace prepaid wallets + ledger (Stripe-backed payments).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.workspace_wallets (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  stripe_customer_id text unique,
  balance_cents bigint not null default 0 check (balance_cents >= 0),
  currency text not null default 'usd',
  ad_spend_limit_cents bigint check (ad_spend_limit_cents is null or ad_spend_limit_cents >= 0),
  usage_limit_cents bigint check (usage_limit_cents is null or usage_limit_cents >= 0),
  usage_mtd_cents bigint not null default 0 check (usage_mtd_cents >= 0),
  ad_spend_mtd_cents bigint not null default 0 check (ad_spend_mtd_cents >= 0),
  mtd_period_start date not null default date_trunc('month', timezone('utc', now()))::date,
  auto_reload_enabled boolean not null default false,
  auto_reload_threshold_cents bigint check (
    auto_reload_threshold_cents is null or auto_reload_threshold_cents >= 0
  ),
  auto_reload_target_cents bigint check (
    auto_reload_target_cents is null or auto_reload_target_cents >= 0
  ),
  stripe_default_payment_method_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_wallets_auto_reload_target_gt_threshold check (
    auto_reload_target_cents is null
    or auto_reload_threshold_cents is null
    or auto_reload_target_cents > auto_reload_threshold_cents
  )
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  type text not null check (
    type in (
      'credit_purchase',
      'auto_reload',
      'ai_usage',
      'ad_spend',
      'adjustment',
      'refund'
    )
  ),
  amount_cents bigint not null,
  balance_after_cents bigint not null check (balance_after_cents >= 0),
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  stripe_object_id text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists wallet_transactions_stripe_object_uidx
  on public.wallet_transactions (stripe_object_id)
  where stripe_object_id is not null;

create index if not exists wallet_transactions_workspace_created_idx
  on public.wallet_transactions (workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers: month rollover for MTD counters
-- ---------------------------------------------------------------------------

create or replace function public.wallet_ensure_mtd_period(w public.workspace_wallets)
returns public.workspace_wallets
language plpgsql
as $$
declare
  current_period date := date_trunc('month', timezone('utc', now()))::date;
begin
  if w.mtd_period_start < current_period then
    update public.workspace_wallets
    set
      usage_mtd_cents = 0,
      ad_spend_mtd_cents = 0,
      mtd_period_start = current_period,
      updated_at = now()
    where workspace_id = w.workspace_id
    returning * into w;
  end if;
  return w;
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic debit (refuses if balance would go negative)
-- ---------------------------------------------------------------------------

create or replace function public.debit_wallet(
  p_workspace_id uuid,
  p_amount_cents bigint,
  p_type text,
  p_description text default '',
  p_metadata jsonb default '{}'::jsonb,
  p_created_by uuid default null,
  p_stripe_object_id text default null
)
returns public.wallet_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.workspace_wallets;
  tx public.wallet_transactions;
  new_balance bigint;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'debit amount must be positive';
  end if;

  if p_type not in ('ai_usage', 'ad_spend', 'adjustment') then
    raise exception 'invalid debit type: %', p_type;
  end if;

  select * into w
  from public.workspace_wallets
  where workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception 'wallet not found';
  end if;

  w := public.wallet_ensure_mtd_period(w);

  if w.balance_cents < p_amount_cents then
    raise exception 'insufficient_balance';
  end if;

  new_balance := w.balance_cents - p_amount_cents;

  update public.workspace_wallets
  set
    balance_cents = new_balance,
    usage_mtd_cents = case
      when p_type = 'ai_usage' then usage_mtd_cents + p_amount_cents
      else usage_mtd_cents
    end,
    ad_spend_mtd_cents = case
      when p_type = 'ad_spend' then ad_spend_mtd_cents + p_amount_cents
      else ad_spend_mtd_cents
    end,
    updated_at = now()
  where workspace_id = p_workspace_id;

  insert into public.wallet_transactions (
    workspace_id,
    type,
    amount_cents,
    balance_after_cents,
    description,
    metadata,
    stripe_object_id,
    created_by
  )
  values (
    p_workspace_id,
    p_type,
    -p_amount_cents,
    new_balance,
    coalesce(p_description, ''),
    coalesce(p_metadata, '{}'::jsonb),
    p_stripe_object_id,
    p_created_by
  )
  returning * into tx;

  return tx;
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic credit (idempotent on stripe_object_id)
-- ---------------------------------------------------------------------------

create or replace function public.credit_wallet(
  p_workspace_id uuid,
  p_amount_cents bigint,
  p_type text,
  p_description text default '',
  p_metadata jsonb default '{}'::jsonb,
  p_created_by uuid default null,
  p_stripe_object_id text default null
)
returns public.wallet_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.workspace_wallets;
  tx public.wallet_transactions;
  new_balance bigint;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'credit amount must be positive';
  end if;

  if p_type not in ('credit_purchase', 'auto_reload', 'adjustment', 'refund') then
    raise exception 'invalid credit type: %', p_type;
  end if;

  if p_stripe_object_id is not null then
    select * into tx
    from public.wallet_transactions
    where stripe_object_id = p_stripe_object_id;
    if found then
      return tx;
    end if;
  end if;

  select * into w
  from public.workspace_wallets
  where workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception 'wallet not found';
  end if;

  new_balance := w.balance_cents + p_amount_cents;

  update public.workspace_wallets
  set
    balance_cents = new_balance,
    updated_at = now()
  where workspace_id = p_workspace_id;

  insert into public.wallet_transactions (
    workspace_id,
    type,
    amount_cents,
    balance_after_cents,
    description,
    metadata,
    stripe_object_id,
    created_by
  )
  values (
    p_workspace_id,
    p_type,
    p_amount_cents,
    new_balance,
    coalesce(p_description, ''),
    coalesce(p_metadata, '{}'::jsonb),
    p_stripe_object_id,
    p_created_by
  )
  returning * into tx;

  return tx;
exception
  when unique_violation then
    select * into tx
    from public.wallet_transactions
    where stripe_object_id = p_stripe_object_id;
    return tx;
end;
$$;

revoke all on function public.debit_wallet(uuid, bigint, text, text, jsonb, uuid, text) from public;
revoke all on function public.credit_wallet(uuid, bigint, text, text, jsonb, uuid, text) from public;
grant execute on function public.debit_wallet(uuid, bigint, text, text, jsonb, uuid, text) to service_role;
grant execute on function public.credit_wallet(uuid, bigint, text, text, jsonb, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- RLS: members can read; mutations go through service role / RPCs
-- ---------------------------------------------------------------------------

alter table public.workspace_wallets enable row level security;
alter table public.wallet_transactions enable row level security;

create policy "workspace_wallets_select_member" on public.workspace_wallets
  for select using (public.is_workspace_member(workspace_id));

create policy "wallet_transactions_select_member" on public.wallet_transactions
  for select using (public.is_workspace_member(workspace_id));
