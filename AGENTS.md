# AGENTS.md

## Cursor Cloud specific instructions

Product Agent is a single Next.js 16 app (`product-agent`, pnpm, Node >=22) backed by
Supabase (Postgres + Auth + Storage). Standard scripts live in `package.json` and
`README.md` — use those; only the non-obvious startup caveats are captured here.

### Services and how to run them

- **Next.js dev server** — `pnpm dev` (http://localhost:3000). This is the product.
- **Supabase local stack** — hard dependency for anything beyond static pages (auth,
  workspaces, products, wallet all hit Postgres). It runs as Docker containers via the
  Supabase CLI. Docker and the Supabase CLI are pre-installed in the VM image; they are
  intentionally NOT in the update script (system deps / heavy image pulls), so you must
  start them each session:
  1. Start the Docker daemon (no systemd here):
     `sudo dockerd > /tmp/dockerd.log 2>&1 &` then `sudo chmod 666 /var/run/docker.sock`
     (daemon is preconfigured for `fuse-overlayfs` with the containerd snapshotter
     disabled in `/etc/docker/daemon.json`, and iptables is set to `iptables-legacy` —
     both required for Docker-in-Docker to work in this VM).
  2. From the repo root: `supabase start` (first run pulls images; applies
     `supabase/migrations/*` and `supabase/seed.sql` automatically). Get URLs/keys with
     `supabase status`. Studio: http://localhost:54323, Mailpit (auth emails):
     http://localhost:54324.

### Environment file

- The app reads `.env.local` (gitignored). For local Supabase it needs
  `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, the publishable key, and
  `SUPABASE_SERVICE_ROLE_KEY`. The local stack uses fixed well-known demo keys, so copy
  them from `supabase status` (`PUBLISHABLE_KEY` / `ANON_KEY` / `SERVICE_ROLE_KEY`). Also
  set `NEXT_PUBLIC_APP_URL=http://localhost:3000`. If `.env.local` is missing, recreate it
  from these values (see `.env.example` for the full variable list).

### Supabase grants caveat (important, non-obvious)

Recent Supabase local Postgres images ship restricted default privileges: new
public-schema tables grant only `TRUNCATE/REFERENCES/TRIGGER` (not
`SELECT/INSERT/UPDATE/DELETE`) to the `anon`/`authenticated`/`service_role` API roles.
Hosted Supabase grants full DML by default, which is what the migrations in
`supabase/migrations/` assume. Without the grants the app fails at runtime with Postgres
error `42501 "permission denied for table ..."` (e.g. `workspace_members` during signup).
`supabase/seed.sql` fixes this for local dev (it only runs against the local CLI stack,
never hosted `db push`). If you ever apply migrations WITHOUT the seed (e.g. `supabase db
push` to a bare DB), re-run the grants in `supabase/seed.sql` manually. Row-level access
is still enforced by the RLS policies in the migrations.

### Optional integrations

AI agent (AI Gateway), Stripe wallet, Resend invites, Shopify import, and Google OAuth are
all optional and gated behind their own env vars. With them unset the app still runs:
the agent chat serves a deterministic offline stream, and wallet metering is bypassed.

### Notes

- `pnpm build` and `pnpm dev` share `.next`; running a build kills a running dev server —
  restart `pnpm dev` afterward.
- `pnpm lint` currently reports pre-existing React Compiler errors in
  `src/features/agent/agent-composer.tsx` (baseline in the repo, not an env issue).
- `pnpm test:e2e` (Playwright) does `pnpm build` then `next start`; it needs
  `npx playwright install chromium` and a running Supabase stack.
