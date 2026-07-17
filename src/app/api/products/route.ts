import { NextResponse } from "next/server";
import type { CreateProductInput, Product } from "@/domain";
import { createProductInputSchema } from "@/domain";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { createProductId } from "@/lib/products/slugify";
import { getProductRepository } from "@/repositories";

function toProduct(
  input: CreateProductInput,
  workspaceId: string,
): Product {
  const now = new Date().toISOString();
  const shared = {
    id: input.id ?? createProductId(),
    title: input.title,
    handle: input.handle,
    description: input.description,
    status: input.status,
    images: input.images,
    imageAvgColors: input.imageAvgColors,
    channels: [] as string[],
    createdAt: now,
    updatedAt: now,
    workspaceId,
  };

  switch (input.type) {
    case "ecommerce":
      return {
        ...shared,
        type: "ecommerce",
        metadata: input.metadata,
        price: input.price,
        currency: input.currency,
        sku: input.sku || undefined,
        category: input.category || undefined,
      };
    case "mobile_app":
      return {
        ...shared,
        type: "mobile_app",
        metadata: input.metadata,
        price: 0,
        currency: "USD",
      };
    case "website":
      return {
        ...shared,
        type: "website",
        metadata: input.metadata,
        price: 0,
        currency: "USD",
      };
    case "brick_and_mortar":
      return {
        ...shared,
        type: "brick_and_mortar",
        metadata: input.metadata,
        price: 0,
        currency: "USD",
      };
    case "event":
      return {
        ...shared,
        type: "event",
        metadata: input.metadata,
        price: 0,
        currency: "USD",
      };
    case "election":
      return {
        ...shared,
        type: "election",
        metadata: input.metadata,
        price: 0,
        currency: "USD",
      };
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace available" }, { status: 400 });
  }

  const parsed = createProductInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const product = toProduct(parsed.data, active.workspace.id);

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
