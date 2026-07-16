import { MarketingHome } from "@/features/marketing/marketing-home";
import { ProductCatalog } from "@/features/products/product-catalog";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { getProductRepository } from "@/repositories";

export default async function RootPage() {
  const user = await getCurrentUser();

  if (!user) {
    return <MarketingHome />;
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          No workspace yet
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account does not have a workspace. Try signing out and back in,
          or contact support.
        </p>
      </div>
    );
  }

  const products = await getProductRepository();
  const catalog = await products.listProducts(active.workspace.id);

  return <ProductCatalog products={catalog} />;
}
