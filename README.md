# Product Agent

AI marketing workspace for commerce products — [product.ag](https://product.ag).

> Import your products. Product Agent creates, manages, and improves their marketing everywhere.

## What this milestone includes

- Marketing site for logged-out visitors; product catalog when authenticated (server-side, no flash)
- Manual product creation (title, handle, description, price, images, status, SKU, category)
- Shopify OAuth connect + selective product import (variants, inventory, collections)
- Product workspace with intelligence, campaigns, performance chart, and reviewable agent artifacts
- Streaming agent composer (OpenAI when configured; deterministic offline stream otherwise)
- Supabase schema + repository adapters

## Stack

Next.js App Router · React · TypeScript · Tailwind · shadcn/ui · Supabase · Vercel AI SDK · Zod · Vitest · Playwright · pnpm

## Quick start

1. Copy `.env.example` to `.env.local` and fill in Supabase (and optionally OpenAI) credentials.
2. Apply migrations in your Supabase project:
   - `supabase/migrations/001_init.sql`
   - `supabase/migrations/002_sync_profile_email.sql`
   - `supabase/migrations/003_product_assets_bucket.sql`
   - `supabase/migrations/004_storage_buckets_select_policy.sql`
   - `supabase/migrations/005_commerce_catalog.sql`
3. In the Supabase dashboard under **Authentication**:
   - Add redirect URLs: `http://localhost:3000/auth/callback` and your production `https://…/auth/callback`
   - Enable the **Google** provider (OAuth client ID/secret from Google Cloud Console)
   - Keep **Confirm email** enabled for signup verification and change-email
4. (Optional) Configure Shopify import:
   - Create a Partner app and set the redirect URL to `http://localhost:3000/api/integrations/shopify/callback` (and production)
   - Scopes: `read_products`, `read_inventory`
   - Set `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, and `NEXT_PUBLIC_APP_URL` in `.env.local`
5. Run:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), sign up, and start a workspace.

Auth includes email/password, magic link, Google sign-in, password reset, email verification, and change-email from **Account**.

Product images upload to the `product-assets` storage bucket created by migration `003_product_assets_bucket.sql`.

## Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY` also accepted) |
| `NEXT_PUBLIC_APP_URL` | Public app origin for Shopify OAuth redirects |
| `OPENAI_API_KEY` | Server-side OpenAI access for the agent (optional; offline stream used when unset) |
| `SHOPIFY_API_KEY` | Shopify Partner app Client ID (required for import) |
| `SHOPIFY_API_SECRET` | Shopify Partner app Client secret (also used to encrypt stored tokens unless `TOKEN_ENCRYPTION_KEY` is set) |
| `SHOPIFY_SCOPES` | OAuth scopes (default `read_products,read_inventory`) |
| `TOKEN_ENCRYPTION_KEY` | Optional dedicated key for encrypting commerce access tokens |

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
- `lib/` — auth, env helpers, Supabase clients, commerce adapters (`lib/commerce`)

## License

Private — Product Agent
