import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { decryptSecret, encryptSecret } from "@/lib/commerce/crypto";
import { listSquarespaceProducts } from "@/lib/commerce/providers/squarespace";
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
      "squarespace",
      shop,
    );
    if (!connection) {
      return NextResponse.json(
        { error: "No active Squarespace connection. Connect a site first." },
        { status: 404 },
      );
    }

    const accessToken = decryptSecret(connection.accessToken);
    const listed = await listSquarespaceProducts(
      accessToken,
      connection.shopDomain,
    );

    if (listed.encodedPayload !== accessToken) {
      await products.upsertConnection({
        ...connection,
        accessToken: encryptSecret(listed.encodedPayload),
        updatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      shop: connection.shopDomain,
      products: listed.products,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to list Squarespace products";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
