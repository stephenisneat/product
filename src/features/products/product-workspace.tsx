import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type {
  Artifact,
  Campaign,
  PerformancePoint,
  Product,
  ProductIntelligence,
  WorkspacePlan,
} from "@/domain";
import { ArtifactCard } from "@/features/artifacts/artifact-card";
import { PerformanceChart } from "@/features/reporting/performance-chart";
import { PageCanvas } from "@/components/layout/page-canvas";
import { ProductImage } from "@/components/product-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getEntitlements } from "@/lib/billing/entitlements";
import { formatMoney } from "@/lib/format";
import {
  productSummaryLine,
  productTypeLabel,
} from "@/lib/products/product-type";

function productMetaItems(product: Product): string[] {
  const items = [productSummaryLine(product)];

  if (product.type === "ecommerce") {
    items.push(product.metadata.fulfillmentKind);
    if (product.sku) items.push(`SKU ${product.sku}`);
    if (product.variants && product.variants.length > 0) {
      items.push(
        `${product.variants.length} variant${product.variants.length === 1 ? "" : "s"}`,
      );
    }
    if (product.collections && product.collections.length > 0) {
      items.push(product.collections.map((c) => c.title).join(" · "));
    }
  } else if (product.type === "mobile_app") {
    if (product.metadata.bundleId) items.push(product.metadata.bundleId);
  } else if (product.type === "website") {
    if (product.metadata.siteKind) items.push(product.metadata.siteKind);
  } else if (product.type === "brick_and_mortar") {
    items.push(product.metadata.addressLine1);
    if (product.metadata.hours) items.push(product.metadata.hours);
  } else if (product.type === "event") {
    if (product.metadata.capacity) {
      items.push(`Capacity ${product.metadata.capacity}`);
    }
  } else if (product.type === "election") {
    items.push(product.metadata.candidateName);
    if (product.metadata.party) items.push(product.metadata.party);
  }

  items.push(product.channels.join(" · ") || "No channels");
  return items.filter(Boolean);
}

export function ProductWorkspace({
  product,
  intelligence,
  artifacts,
  campaigns,
  performance,
  plan = "free",
}: {
  product: Product;
  intelligence: ProductIntelligence | null;
  artifacts: Artifact[];
  campaigns: Campaign[];
  performance: PerformancePoint[];
  plan?: WorkspacePlan;
}) {
  const proposed = artifacts.filter((a) => a.status === "proposed");
  const isEcommerce = product.type === "ecommerce";
  const ents = getEntitlements(plan);
  const campaignsLocked = !ents.canSpendAndLaunch;

  return (
    <PageCanvas
      header={
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 gap-1.5 text-muted-foreground"
          render={<Link href="/" />}
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Button>
      }
    >
      <div className="px-4 py-6">
        <div className="mb-4 flex flex-wrap items-start gap-4">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
            {product.images[0] ? (
              <ProductImage
                src={product.images[0]}
                avgColor={product.imageAvgColors[0]}
                className="size-full"
                sizes="80px"
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-lg font-semibold tracking-tight">
                {product.title}
              </h1>
              <Badge variant="outline" className="text-[10px] uppercase">
                {productTypeLabel(product.type)}
              </Badge>
              <Badge variant="outline" className="text-[10px] uppercase">
                {product.status}
              </Badge>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {product.description}
            </p>
            <div className="mt-2 flex flex-wrap gap-3 font-mono text-[11px] text-muted-foreground">
              {productMetaItems(product).map((item, index) => (
                <span key={`${index}-${item}`}>{item}</span>
              ))}
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList variant="line" className="w-full justify-start">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="artifacts">
              Artifacts
              {proposed.length > 0 ? (
                <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                  {proposed.length}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="assets">Assets</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            <section>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Positioning
              </h2>
              <p className="text-sm leading-relaxed">
                {intelligence?.positioning ??
                  "No intelligence yet. Ask the agent to draft positioning."}
              </p>
            </section>
            <section className="grid gap-4 sm:grid-cols-2">
              <div>
                <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Audience
                </h2>
                <p className="text-sm text-muted-foreground">
                  {intelligence?.audience ?? "—"}
                </p>
              </div>
              <div>
                <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Tone
                </h2>
                <p className="text-sm text-muted-foreground">{intelligence?.tone ?? "—"}</p>
              </div>
            </section>
            {isEcommerce ? (
              <section>
                <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Variants
                </h2>
                {!product.variants || product.variants.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No variants.</p>
                ) : (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {product.variants.map((variant) => (
                      <li
                        key={variant.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                      >
                        <span className="font-medium">{variant.title}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatMoney(variant.price, variant.currency)}
                          {variant.sku ? ` · ${variant.sku}` : ""}
                          {variant.inventory
                            ? ` · qty ${variant.inventory.quantity}`
                            : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : null}
            <section>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Open proposals
              </h2>
              {proposed.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No open proposals. Use the agent to generate artifacts.
                </p>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {proposed.slice(0, 2).map((artifact) => (
                    <ArtifactCard key={artifact.id} artifact={artifact} />
                  ))}
                </div>
              )}
            </section>
          </TabsContent>

          <TabsContent value="intelligence" className="mt-4 space-y-4">
            {!intelligence ? (
              <p className="text-sm text-muted-foreground">
                Intelligence has not been developed for this product.
              </p>
            ) : (
              <>
                <section>
                  <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Value props
                  </h2>
                  <ul className="list-inside list-disc space-y-1 text-sm">
                    {intelligence.valueProps.map((v) => (
                      <li key={v}>{v}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Objections
                  </h2>
                  <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                    {intelligence.objections.map((v) => (
                      <li key={v}>{v}</li>
                    ))}
                  </ul>
                </section>
              </>
            )}
          </TabsContent>

          <TabsContent value="campaigns" className="mt-4">
            {campaignsLocked ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
                <p className="text-sm font-medium">Campaigns are locked</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Free workspaces can brainstorm campaign concepts with the
                  agent, but saving and launching campaigns requires Hobby or
                  Pro.
                </p>
                <Button
                  render={<Link href="/settings/billing" />}
                  size="sm"
                  className="mt-4"
                >
                  Upgrade
                </Button>
              </div>
            ) : campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No campaigns yet. Ask the agent for a campaign concept.
                {ents.maxCampaignsPerProduct != null
                  ? ` (${ents.maxCampaignsPerProduct} max per product on ${ents.name})`
                  : null}
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {campaigns.map((campaign) => (
                  <li key={campaign.id} className="flex items-start justify-between gap-3 p-3">
                    <div>
                      <p className="text-sm font-medium">{campaign.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {campaign.objective}
                      </p>
                      <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                        {campaign.channels.join(" · ")}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {campaign.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="performance" className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Product-level performance (sample series). Live channel ingestion comes
              later.
            </p>
            <PerformanceChart data={performance} />
          </TabsContent>

          <TabsContent value="artifacts" className="mt-4">
            {artifacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No artifacts yet.</p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {artifacts.map((artifact) => (
                  <ArtifactCard key={artifact.id} artifact={artifact} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="assets" className="mt-4">
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-sm font-medium">Asset library</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Product images and creative assets will live here. Storage is wired for
                Supabase when credentials are configured.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageCanvas>
  );
}
