import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { decryptSecret } from "@/lib/commerce/crypto";
import { listWooCommerceProducts } from "@/lib/commerce/providers/woocommerce";
import { getProductRepository } from "@/repositories";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace available" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const shop = searchParams.get("shop") ?? undefined;

  try {
    const products = await getProductRepository();
    const connection = await products.getConnection(
      active.workspace.id,
      "woocommerce",
      shop,
    );
    if (!connection) {
      return NextResponse.json(
        { error: "No active WooCommerce connection. Connect a store first." },
        { status: 404 },
      );
    }

    const accessToken = decryptSecret(connection.accessToken);
    const storeUrl = `https://${connection.shopDomain}`;
    const remoteProducts = await listWooCommerceProducts(accessToken, storeUrl);

    return NextResponse.json({
      shop: connection.shopDomain,
      products: remoteProducts,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to list WooCommerce products";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
