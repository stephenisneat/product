import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";

export function ProductCatalog({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-heading text-xl font-semibold tracking-tight">No products yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Import products from your commerce platform to start building marketing
          intelligence.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl font-semibold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {products.length} products in your catalog
          </p>
        </div>
      </div>

      <ul className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <li key={product.id} className="bg-background">
            <Link
              href={`/products/${product.id}`}
              className="group flex h-full flex-col outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                {product.images[0] ? (
                  <Image
                    src={product.images[0]}
                    alt=""
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    sizes="(max-width: 640px) 100vw, 25vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    No image
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-medium leading-snug">{product.title}</h2>
                  <Badge
                    variant="outline"
                    className="shrink-0 text-[10px] uppercase tracking-wide"
                  >
                    {product.status}
                  </Badge>
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {product.description}
                </p>
                <div className="mt-auto flex items-center justify-between pt-2 text-xs text-muted-foreground">
                  <span className="font-mono">{formatMoney(product.price, product.currency)}</span>
                  <span>{product.channels.length} channels</span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
