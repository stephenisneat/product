-- Billing v2: action metering, included usage rollover, seats + billing interval.

alter table public.workspace_wallets
  add column if not exists actions_mtd bigint not null default 0
    check (actions_mtd >= 0),
  add column if not exists included_rollover_cents bigint not null default 0
    check (included_rollover_cents >= 0);

alter table public.workspaces
  add column if not exists billing_interval text
    check (billing_interval is null or billing_interval in ('month', 'year')),
  add column if not exists billed_seats integer not null default 1
    check (billed_seats >= 1);

-- Reset MTD counters; rollover is applied in application code before calling this
-- with the precomputed next rollover amount.
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
      actions_mtd = 0,
      -- included_rollover_cents left as-is; app sets the new value on period change
      mtd_period_start = current_period,
      updated_at = now()
    where workspace_id = w.workspace_id
    returning * into w;
  end if;
  return w;
end;
$$;

create or replace function public.charge_ai_usage(
  p_workspace_id uuid,
  p_amount_cents bigint,
  p_included_allotment_cents bigint,
  p_allow_overage boolean,
  p_description text default '',
  p_metadata jsonb default '{}'::jsonb,
  p_created_by uuid default null,
  p_stripe_object_id text default null,
  p_action_count bigint default 1
)
returns public.wallet_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.workspace_wallets;
  tx public.wallet_transactions;
  remaining_included bigint;
  from_balance bigint;
  new_balance bigint;
  meta jsonb;
  actions bigint;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'charge amount must be positive';
  end if;

  if p_included_allotment_cents is null or p_included_allotment_cents < 0 then
    raise exception 'included allotment must be non-negative';
  end if;

  actions := greatest(1, coalesce(p_action_count, 1));

  select * into w
  from public.workspace_wallets
  where workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception 'wallet not found';
  end if;

  w := public.wallet_ensure_mtd_period(w);

  remaining_included := greatest(0, p_included_allotment_cents - w.usage_mtd_cents);
  from_balance := greatest(0, p_amount_cents - remaining_included);

  if from_balance > 0 and not p_allow_overage then
    raise exception 'allotment_exhausted';
  end if;

  if from_balance > w.balance_cents then
    raise exception 'insufficient_balance';
  end if;

  new_balance := w.balance_cents - from_balance;

  update public.workspace_wallets
  set
    balance_cents = new_balance,
    usage_mtd_cents = usage_mtd_cents + p_amount_cents,
    actions_mtd = actions_mtd + actions,
    updated_at = now()
  where workspace_id = p_workspace_id;

  meta := coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
    'from_included_cents', p_amount_cents - from_balance,
    'from_balance_cents', from_balance,
    'included_allotment_cents', p_included_allotment_cents,
    'action_count', actions
  );

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
    'ai_usage',
    -p_amount_cents,
    new_balance,
    coalesce(p_description, ''),
    meta,
    p_stripe_object_id,
    p_created_by
  )
  returning * into tx;

  return tx;
end;
$$;

revoke all on function public.charge_ai_usage(
  uuid, bigint, bigint, boolean, text, jsonb, uuid, text, bigint
) from public;
grant execute on function public.charge_ai_usage(
  uuid, bigint, bigint, boolean, text, jsonb, uuid, text, bigint
) to service_role;

-- Drop older 8-arg overload if present (from 013).
drop function if exists public.charge_ai_usage(
  uuid, bigint, bigint, boolean, text, jsonb, uuid, text
);
