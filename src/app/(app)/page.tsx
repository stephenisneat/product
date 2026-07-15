import { MarketingHome } from "@/features/marketing/marketing-home";
import { ProductCatalog } from "@/features/products/product-catalog";
import { getCurrentUser } from "@/lib/auth/session";
import { getProductRepository } from "@/repositories";

export default async function RootPage() {
  const user = await getCurrentUser();

  if (!user) {
    return <MarketingHome />;
  }

  const products = await getProductRepository();
  const catalog = await products.listProducts(user.id);

  return <ProductCatalog products={catalog} />;
}
