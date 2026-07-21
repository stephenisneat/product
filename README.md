# Product Agent

AI marketing workspace for commerce products — [product.ag](https://product.ag).

> Import your products. Product Agent creates, manages, and improves their marketing everywhere.

## What this milestone includes

- Marketing site for logged-out visitors; product catalog when authenticated (server-side, no flash)
- Manual product creation (title, handle, description, price, images, status, SKU, category)
- Shopify, WooCommerce, BigCommerce, Amazon, and Squarespace connect + selective product import (variants, inventory, collections)
- Ad channel OAuth connect for Google Ads (with campaign management), Meta, TikTok, Amazon Ads, and X
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
   - …through latest, including `030_ad_connections.sql` and `033_ad_channel_providers.sql`
3. In the Supabase dashboard under **Authentication**:
   - Add redirect URLs: `http://localhost:3000/auth/callback` and your production `https://…/auth/callback`
   - Enable the **Google** provider (OAuth client ID/secret from Google Cloud Console)
   - Keep **Confirm email** enabled for signup verification and change-email
4. (Optional) Configure commerce import:
   - **Shopify**: Partner app redirect `…/api/integrations/shopify/callback`; scopes `read_products`, `read_inventory`; set `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `NEXT_PUBLIC_APP_URL`
   - **WooCommerce**: store URL + REST API consumer key/secret in the import UI; set `TOKEN_ENCRYPTION_KEY` (or another commerce secret) to encrypt credentials
   - **BigCommerce**: app callback `…/api/integrations/bigcommerce/callback`; set `BIGCOMMERCE_CLIENT_ID`, `BIGCOMMERCE_CLIENT_SECRET`, `NEXT_PUBLIC_APP_URL`
   - **Amazon**: SP-API + LWA redirect `…/api/integrations/amazon/callback`; set `AMAZON_LWA_CLIENT_ID`, `AMAZON_LWA_CLIENT_SECRET`, `AMAZON_SP_API_APP_ID`, `NEXT_PUBLIC_APP_URL`
   - **Squarespace**: OAuth redirect `…/api/integrations/squarespace/callback`; set `SQUARESPACE_CLIENT_ID`, `SQUARESPACE_CLIENT_SECRET`, `NEXT_PUBLIC_APP_URL`
5. (Optional) Configure ad channels (Settings → Connections):
   - **Google Ads**: OAuth client + developer token; redirect `…/api/integrations/google-ads/callback`; set `GOOGLE_ADS_*`
   - **Meta Ads**: Meta app with Marketing API; redirect `…/api/integrations/meta/callback`; set `META_APP_ID`, `META_APP_SECRET`
   - **TikTok Ads**: Marketing API app; redirect `…/api/integrations/tiktok/callback`; set `TIKTOK_ADS_APP_ID`, `TIKTOK_ADS_APP_SECRET`
   - **Amazon Ads**: Advertising API LWA (separate from SP-API commerce); redirect `…/api/integrations/amazon-ads/callback`; set `AMAZON_ADS_CLIENT_ID`, `AMAZON_ADS_CLIENT_SECRET`
   - **X Ads**: OAuth 2.0 app with PKCE; redirect `…/api/integrations/x-ads/callback`; set `X_ADS_CLIENT_ID`, `X_ADS_CLIENT_SECRET`
   - Apply migrations `030_ad_connections.sql` and `033_ad_channel_providers.sql`
6. (Optional) Configure Resend for workspace invites:
   - Set `RESEND_API_KEY` and optionally `RESEND_FROM` in `.env.local`
7. Run:

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
| `NEXT_PUBLIC_APP_URL` | Public app origin for commerce OAuth redirects |
| `VERCEL_OIDC_TOKEN` | AI Gateway auth for local dev (from `vercel env pull .env.local`; optional offline stream when unset) |
| `AI_GATEWAY_API_KEY` | Optional static AI Gateway key for CI / non-Vercel environments |
| `SHOPIFY_API_KEY` | Shopify Partner app Client ID (required for Shopify import) |
| `SHOPIFY_API_SECRET` | Shopify Partner app Client secret (also used to encrypt stored tokens unless `TOKEN_ENCRYPTION_KEY` is set) |
| `SHOPIFY_SCOPES` | OAuth scopes (default `read_products,read_inventory`) |
| `BIGCOMMERCE_CLIENT_ID` | BigCommerce app Client ID |
| `BIGCOMMERCE_CLIENT_SECRET` | BigCommerce app Client secret |
| `AMAZON_LWA_CLIENT_ID` | Amazon Login with Amazon client ID |
| `AMAZON_LWA_CLIENT_SECRET` | Amazon Login with Amazon client secret |
| `AMAZON_SP_API_APP_ID` | Amazon SP-API application ID |
| `SQUARESPACE_CLIENT_ID` | Squarespace app Client ID |
| `SQUARESPACE_CLIENT_SECRET` | Squarespace app Client secret |
| `TOKEN_ENCRYPTION_KEY` | Optional dedicated key for encrypting commerce / ads tokens |
| `GOOGLE_ADS_CLIENT_ID` | Google Cloud OAuth client ID (required for Google Ads connect) |
| `GOOGLE_ADS_CLIENT_SECRET` | Google Cloud OAuth client secret |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads API developer token from API Center |
| `GOOGLE_ADS_REDIRECT_URI` | Optional OAuth redirect (default `${NEXT_PUBLIC_APP_URL}/api/integrations/google-ads/callback`) |
| `GOOGLE_ADS_API_VERSION` | Optional REST API version (default `v19`) |
| `META_APP_ID` | Meta app ID (required for Meta Ads connect) |
| `META_APP_SECRET` | Meta app secret |
| `TIKTOK_ADS_APP_ID` | TikTok Marketing API app ID |
| `TIKTOK_ADS_APP_SECRET` | TikTok Marketing API app secret |
| `AMAZON_ADS_CLIENT_ID` | Amazon Advertising API LWA client ID |
| `AMAZON_ADS_CLIENT_SECRET` | Amazon Advertising API LWA client secret |
| `X_ADS_CLIENT_ID` | X OAuth 2.0 client ID |
| `X_ADS_CLIENT_SECRET` | X OAuth 2.0 client secret |
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
- `lib/` — auth, env helpers, Supabase clients, commerce adapters (`lib/commerce`), ad channels (`lib/channels`)

## License

Private — Product Agent
