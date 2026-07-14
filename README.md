# Product Agent

AI marketing workspace for commerce products — [product.ag](https://product.ag).

> Import your products. Product Agent creates, manages, and improves their marketing everywhere.

## What this milestone includes

- Marketing site for logged-out visitors; product catalog when authenticated (server-side, no flash)
- Demo mode that runs with no Supabase or OpenAI credentials
- Product workspace with intelligence, campaigns, performance chart, and reviewable agent artifacts
- Streaming agent composer (OpenAI when configured; deterministic demo stream otherwise)
- Supabase schema + repository adapters ready when you add credentials

## Stack

Next.js App Router · React · TypeScript · Tailwind · shadcn/ui · Supabase · Vercel AI SDK · Zod · Vitest · Playwright · pnpm

## Quick start (demo mode)

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and click **Enter demo**.

No `.env` file is required for demo mode.

## Production credentials

Copy `.env.example` to `.env.local` and fill in:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY` also accepted) |
| `OPENAI_API_KEY` | Server-side OpenAI access for the agent |
| `DEMO_SESSION_SECRET` | Optional HMAC secret for demo session cookies |

Apply `supabase/migrations/001_init.sql` in your Supabase project. Create a public `product-assets` storage bucket when you are ready to store uploaded product images.

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
- `repositories/` — demo vs Supabase adapters
- `lib/` — auth, mode detection, Supabase clients, demo store

## License

Private — Product Agent
