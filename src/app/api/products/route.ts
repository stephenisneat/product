import { NextResponse } from "next/server";
import type { Product } from "@/domain";
import { createProductInputSchema } from "@/domain";
import { getCurrentUser } from "@/lib/auth/session";
import { createProductId } from "@/lib/products/slugify";
import { getProductRepository } from "@/repositories";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createProductInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const input = parsed.data;
  const product: Product = {
    id: input.id ?? createProductId(),
    title: input.title,
    handle: input.handle,
    description: input.description,
    status: input.status,
    price: input.price,
    currency: input.currency,
    images: input.images,
    imageAvgColors: input.imageAvgColors,
    channels: [],
    sku: input.sku || undefined,
    category: input.category || undefined,
    createdAt: now,
    updatedAt: now,
    ownerId: user.id,
  };

  try {
    const products = await getProductRepository();
    const existing = await products.getProduct(product.id);
    if (existing) {
      return NextResponse.json({ error: "Product already exists" }, { status: 409 });
    }

    const saved = await products.createProduct(product);
    return NextResponse.json({ product: saved }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create product";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
