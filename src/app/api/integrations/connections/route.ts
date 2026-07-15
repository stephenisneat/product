import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasShopifyConfig } from "@/lib/commerce/providers/shopify";
import { getProductRepository } from "@/repositories";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const products = await getProductRepository();
    const connections = await products.listConnections(user.id);
    return NextResponse.json({
      shopifyConfigured: hasShopifyConfig(),
      connections,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list connections";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
