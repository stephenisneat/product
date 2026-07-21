import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { hasGoogleAdsConfig } from "@/lib/channels/providers/google-ads";
import { hasAmazonConfig } from "@/lib/commerce/providers/amazon";
import { hasBigCommerceConfig } from "@/lib/commerce/providers/bigcommerce";
import { hasShopifyConfig } from "@/lib/commerce/providers/shopify";
import { hasSquarespaceConfig } from "@/lib/commerce/providers/squarespace";
import { hasWooCommerceConfig } from "@/lib/commerce/providers/woocommerce";
import { getAdConnectionRepository, getProductRepository } from "@/repositories";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace available" }, { status: 400 });
  }

  try {
    const [products, ads] = await Promise.all([
      getProductRepository(),
      getAdConnectionRepository(),
    ]);
    const [connections, adConnections] = await Promise.all([
      products.listConnections(active.workspace.id),
      ads.listConnections(active.workspace.id),
    ]);
    return NextResponse.json({
      shopifyConfigured: hasShopifyConfig(),
      woocommerceConfigured: hasWooCommerceConfig(),
      bigcommerceConfigured: hasBigCommerceConfig(),
      amazonConfigured: hasAmazonConfig(),
      squarespaceConfigured: hasSquarespaceConfig(),
      googleAdsConfigured: hasGoogleAdsConfig(),
      connections,
      adConnections,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list connections";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
