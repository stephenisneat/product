import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { decryptSecret } from "@/lib/commerce/crypto";
import {
  fetchWooCommerceProductsByIds,
  getWooCommerceCurrency,
} from "@/lib/commerce/providers/woocommerce";
import { getProductRepository } from "@/repositories";

const importBodySchema = z.object({
  productIds: z.array(z.string().min(1)).min(1, "Select at least one product"),
  shop: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace available" }, { status: 400 });
  }

  const parsed = importBodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const repo = await getProductRepository();
    const connection = await repo.getConnection(
      active.workspace.id,
      "woocommerce",
      parsed.data.shop,
    );
    if (!connection) {
      return NextResponse.json(
        { error: "No active WooCommerce connection. Connect a store first." },
        { status: 404 },
      );
    }

    const accessToken = decryptSecret(connection.accessToken);
    const storeUrl = `https://${connection.shopDomain}`;
    const currency = await getWooCommerceCurrency(accessToken, storeUrl);
    const canonical = await fetchWooCommerceProductsByIds(
      accessToken,
      storeUrl,
      parsed.data.productIds,
      currency,
    );

    const imported = [];
    for (const product of canonical) {
      imported.push(
        await repo.upsertImportedProduct(product, active.workspace.id),
      );
    }

    return NextResponse.json({
      imported: imported.length,
      products: imported.map((product) => ({
        id: product.id,
        title: product.title,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to import products";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
