import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { getArtifactRepository, getProductRepository } from "@/repositories";

export const runtime = "nodejs";

export type AgentMentionItem = {
  value: string;
  id: string;
  type: "product" | "campaign" | "creative";
};

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace available" }, { status: 400 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const productId = url.searchParams.get("productId") ?? undefined;

  const productsRepo = await getProductRepository();
  const products = await productsRepo.listProducts(active.workspace.id);

  const items: AgentMentionItem[] = [];

  for (const product of products) {
    if (!q || product.title.toLowerCase().includes(q)) {
      items.push({
        value: product.title,
        id: product.id,
        type: "product",
      });
    }
  }

  const mentionProductIds = productId
    ? [productId]
    : products.slice(0, 12).map((p) => p.id);

  const artifactsRepo = await getArtifactRepository();

  await Promise.all(
    mentionProductIds.map(async (id) => {
      const [campaigns, artifacts] = await Promise.all([
        productsRepo.listCampaigns(id),
        artifactsRepo.listByProduct(id),
      ]);

      for (const campaign of campaigns) {
        if (!q || campaign.name.toLowerCase().includes(q)) {
          items.push({
            value: campaign.name,
            id: campaign.id,
            type: "campaign",
          });
        }
      }

      for (const artifact of artifacts) {
        if (!q || artifact.title.toLowerCase().includes(q)) {
          items.push({
            value: artifact.title,
            id: artifact.id,
            type: "creative",
          });
        }
      }
    }),
  );

  items.sort((a, b) => a.value.localeCompare(b.value));

  return NextResponse.json({ items: items.slice(0, 40) });
}
