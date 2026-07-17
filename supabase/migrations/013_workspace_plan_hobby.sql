-- Add Hobby tier + Stripe subscription fields on workspaces.
-- Included monthly AI allotment is derived from plan entitlements in app code
-- (usage_mtd vs included cents); purchased wallet balance is for top-offs only.

alter table public.workspaces
  drop constraint if exists workspaces_plan_check;

alter table public.workspaces
  add constraint workspaces_plan_check
  check (plan in ('free', 'hobby', 'pro'));

alter table public.workspaces
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_subscription_status text;

create unique index if not exists workspaces_stripe_subscription_uidx
  on public.workspaces (stripe_subscription_id)
  where stripe_subscription_id is not null;

-- Record AI usage: count full amount against MTD; debit purchased balance only for overage.
create or replace function public.charge_ai_usage(
  p_workspace_id uuid,
  p_amount_cents bigint,
  p_included_allotment_cents bigint,
  p_allow_overage boolean,
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
  remaining_included bigint;
  from_balance bigint;
  new_balance bigint;
  meta jsonb;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'charge amount must be positive';
  end if;

  if p_included_allotment_cents is null or p_included_allotment_cents < 0 then
    raise exception 'included allotment must be non-negative';
  end if;

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
    updated_at = now()
  where workspace_id = p_workspace_id;

  meta := coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
    'from_included_cents', p_amount_cents - from_balance,
    'from_balance_cents', from_balance,
    'included_allotment_cents', p_included_allotment_cents
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
  uuid, bigint, bigint, boolean, text, jsonb, uuid, text
) from public;
grant execute on function public.charge_ai_usage(
  uuid, bigint, bigint, boolean, text, jsonb, uuid, text
) to service_role;
