import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { decryptSecret } from "@/lib/commerce/crypto";
import { listShopifyProducts } from "@/lib/commerce/providers/shopify";
import { getProductRepository } from "@/repositories";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const shop = searchParams.get("shop") ?? undefined;

  try {
    const products = await getProductRepository();
    const connection = await products.getConnection(user.id, "shopify", shop);
    if (!connection) {
      return NextResponse.json(
        { error: "No active Shopify connection. Connect a store first." },
        { status: 404 },
      );
    }

    const accessToken = decryptSecret(connection.accessToken);
    const remoteProducts = await listShopifyProducts(
      accessToken,
      connection.shopDomain,
    );

    return NextResponse.json({
      shop: connection.shopDomain,
      products: remoteProducts,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list Shopify products";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
