import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { encryptSecret } from "@/lib/commerce/crypto";
import {
  encodeCredentials,
  hasWooCommerceConfig,
  normalizeStoreUrl,
  storeDomainFromUrl,
  verifyWooCommerceCredentials,
} from "@/lib/commerce/providers/woocommerce";
import { createConnectionId } from "@/lib/products/slugify";
import { getProductRepository } from "@/repositories";

const connectBodySchema = z.object({
  storeUrl: z.string().min(1),
  consumerKey: z.string().min(1),
  consumerSecret: z.string().min(1),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasWooCommerceConfig()) {
    return NextResponse.json(
      {
        error:
          "WooCommerce is not configured. Set TOKEN_ENCRYPTION_KEY (or another commerce secret) and NEXT_PUBLIC_APP_URL.",
      },
      { status: 503 },
    );
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace available" }, { status: 400 });
  }

  const parsed = connectBodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let storeUrl: string;
  try {
    storeUrl = normalizeStoreUrl(parsed.data.storeUrl);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Invalid store URL",
      },
      { status: 400 },
    );
  }

  const credentials = {
    consumerKey: parsed.data.consumerKey.trim(),
    consumerSecret: parsed.data.consumerSecret.trim(),
  };

  try {
    await verifyWooCommerceCredentials(storeUrl, credentials);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not verify WooCommerce credentials",
      },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const shopDomain = storeDomainFromUrl(storeUrl);
  const products = await getProductRepository();
  await products.upsertConnection({
    id: createConnectionId(),
    workspaceId: active.workspace.id,
    provider: "woocommerce",
    shopDomain,
    accessToken: encryptSecret(encodeCredentials(credentials)),
    scope: "read",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({
    connected: true,
    shop: shopDomain,
    storeUrl,
  });
}
