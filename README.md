# Product Agent

AI marketing workspace for commerce products — [product.ag](https://product.ag).

> Import your products. Product Agent creates, manages, and improves their marketing everywhere.

## What this milestone includes

- Marketing site for logged-out visitors; product catalog when authenticated (server-side, no flash)
- Manual product creation (title, handle, description, price, images, status, SKU, category)
- Shopify OAuth connect + selective product import (variants, inventory, collections)
- Product workspace with intelligence, campaigns, performance chart, and reviewable agent artifacts
- Streaming agent composer (OpenAI when configured; deterministic offline stream otherwise)
- Multi-tenant workspaces with roles (owner/admin/member) and email invites via Resend
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
   - `supabase/migrations/006_image_avg_colors.sql`
   - `supabase/migrations/007_workspaces.sql`
3. In the Supabase dashboard under **Authentication**:
   - Add redirect URLs: `http://localhost:3000/auth/callback` and your production `https://…/auth/callback`
   - Enable the **Google** provider (OAuth client ID/secret from Google Cloud Console)
   - Keep **Confirm email** enabled for signup verification and change-email
4. (Optional) Configure Shopify import:
   - Create a Partner app and set the redirect URL to `http://localhost:3000/api/integrations/shopify/callback` (and production)
   - Scopes: `read_products`, `read_inventory`
   - Set `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, and `NEXT_PUBLIC_APP_URL` in `.env.local`
5. (Optional) Configure Resend for workspace invites:
   - Set `RESEND_API_KEY` and optionally `RESEND_FROM` in `.env.local`
6. Run:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), sign up, and start a workspace. A default workspace is created automatically on account creation.

Auth includes email/password, magic link, Google sign-in, password reset, email verification, and change-email from **Account**. Manage teammates under **Workspace settings**.

Product images upload to the `product-assets` storage bucket created by migration `003_product_assets_bucket.sql`.

## Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY` also accepted) |
| `NEXT_PUBLIC_APP_URL` | Public app origin for Shopify OAuth redirects |
| `VERCEL_OIDC_TOKEN` | AI Gateway auth for local dev (from `vercel env pull .env.local`; optional offline stream when unset) |
| `AI_GATEWAY_API_KEY` | Optional static AI Gateway key for CI / non-Vercel environments |
| `SHOPIFY_API_KEY` | Shopify Partner app Client ID (required for import) |
| `SHOPIFY_API_SECRET` | Shopify Partner app Client secret (also used to encrypt stored tokens unless `TOKEN_ENCRYPTION_KEY` is set) |
| `SHOPIFY_SCOPES` | OAuth scopes (default `read_products,read_inventory`) |
| `TOKEN_ENCRYPTION_KEY` | Optional dedicated key for encrypting commerce access tokens |
| `RESEND_API_KEY` | Resend API key for workspace invite emails |
| `RESEND_FROM` | Optional From address for invite emails |
| `TRIGGER_SECRET_KEY` | Trigger.dev secret key for enqueueing background jobs (Vercel + local) |
| `TRIGGER_PROJECT_ID` | Optional Trigger.dev project ref (defaults in `trigger.config.ts`) |
| `ELEVENLABS_API_KEY` | ElevenLabs API key (video stage TTS; voices auto-cast from library) |
| `ELEVENLABS_VOICE_ID` | Optional pin for narrator / voiceover |
| `ELEVENLABS_DIALOGUE_VOICE_ID` | Optional pin for the first dialogue character |
| `RUNWAYML_API_SECRET` | Runway API secret (Veo 3.1 image-to-video) |

Trigger.dev **workers** do not inherit Vercel env. In the Trigger dashboard → Environment Variables (prod), also set:

- `NEXT_PUBLIC_SUPABASE_URL` — must be the **Project URL** from Supabase → Settings → API (`https://<project-ref>.supabase.co`). Do not use localhost, `supabase.com`, or the bare project ref. A wrong value surfaces as Supabase’s `"Project not specified."`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY`
- `AI_GATEWAY_API_KEY` (or OIDC equivalent) for screenplay/storyboard
- `ELEVENLABS_API_KEY` and `RUNWAYML_API_SECRET` for the video stage (optional `ELEVENLABS_VOICE_ID` / `ELEVENLABS_DIALOGUE_VOICE_ID` to pin casts)

Use the same values as Vercel production. Then deploy workers with `pnpm exec trigger deploy`. Video-stage jobs can take several minutes (Veo per scene + Remotion stitch); hanging until `maxDuration` usually means missing worker env.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm dev:trigger` | Trigger.dev worker (run alongside `pnpm dev` for background jobs) |
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
