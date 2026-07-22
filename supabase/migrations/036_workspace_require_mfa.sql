-- Optional workspace policy: owners can require members to use MFA (2FA).

alter table public.workspaces
  add column if not exists require_mfa boolean not null default false;

comment on column public.workspaces.require_mfa is
  'When true, members must have MFA enrolled and verified to use this workspace.';
