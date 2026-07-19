-- Audit log for auth sessions (active + revoked history).

create table if not exists public.user_session_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null,
  event text not null check (event in ('login', 'revoke')),
  user_agent text,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists user_session_events_user_id_created_at_idx
  on public.user_session_events (user_id, created_at desc);

create index if not exists user_session_events_session_id_idx
  on public.user_session_events (session_id);

alter table public.user_session_events enable row level security;

create policy "user_session_events_select_own"
  on public.user_session_events
  for select
  using (auth.uid() = user_id);

-- Inserts/updates go through service role from API routes.
