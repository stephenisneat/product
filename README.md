# Product Agent

AI marketing workspace for commerce products — [product.ag](https://product.ag).

> Import your products. Product Agent creates, manages, and improves their marketing everywhere.

## What this milestone includes

- Marketing site for logged-out visitors; product catalog when authenticated (server-side, no flash)
- Product workspace with intelligence, campaigns, performance chart, and reviewable agent artifacts
- Streaming agent composer (OpenAI when configured; deterministic offline stream otherwise)
- Supabase schema + repository adapters

## Stack

Next.js App Router · React · TypeScript · Tailwind · shadcn/ui · Supabase · Vercel AI SDK · Zod · Vitest · Playwright · pnpm

## Quick start

1. Copy `.env.example` to `.env.local` and fill in Supabase (and optionally OpenAI) credentials.
2. Apply `supabase/migrations/001_init.sql` in your Supabase project.
3. Run:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), sign up, and start a workspace.

Create a public `product-assets` storage bucket when you are ready to store uploaded product images.

## Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY` also accepted) |
| `OPENAI_API_KEY` | Server-side OpenAI access for the agent (optional; offline stream used when unset) |

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier write |
| `pnpm typecheck` | TypeScript |
| `pnpm test` | Vitest unit tests |
| `pnpm test:e2e` | Playwright (expects a production build; runs `next start`) |

## Architecture

Modular monolith under `src/`:

- `app/` — routes and API handlers
- `features/` — product, auth, agent, marketing UI
- `domain/` — Zod schemas
- `repositories/` — Supabase adapters
- `lib/` — auth, env helpers, Supabase clients

## License

Private — Product Agent
