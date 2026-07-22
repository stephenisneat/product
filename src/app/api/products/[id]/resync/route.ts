import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { resyncImportedProduct } from "@/lib/commerce/resync-product";
import { logServerError, unknownErrorMessage } from "@/lib/errors";
import { getProductRepository } from "@/repositories";

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace available" }, { status: 400 });
  }

  const { id } = await context.params;
  const products = await getProductRepository();
  const existing = await products.getProduct(id);
  if (!existing || existing.workspaceId !== active.workspace.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const product = await resyncImportedProduct(products, existing);
    return NextResponse.json({ product });
  } catch (error) {
    logServerError("api.products.resync", error, { productId: id });
    return NextResponse.json(
      { error: unknownErrorMessage(error, "Failed to re-sync product.") },
      { status: 500 },
    );
  }
}
