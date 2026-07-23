"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type {
  Campaign,
  Creative,
  Goal,
  Insight,
  PerformancePoint,
  Product,
  ProductIntelligence,
  WorkspacePlan,
} from "@/domain";
import { deliverableCampaignIds, isApplyDeliverableAction } from "@/domain";
import { CreativeCard } from "@/features/creatives/creative-card";
import { useAgentContext } from "@/features/agent/agent-context";
import { UpgradeButton } from "@/features/billing/upgrade-button";
import { InsightCard } from "@/features/insights/insight-card";
import { ProductImage } from "@/components/product-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getEntitlements } from "@/lib/billing/entitlements";
import { formatMoney } from "@/lib/format";
import { productTypeLabel } from "@/lib/products/product-type";

function StreamHeading({
  id,
  title,
  description,
  action,
}: {
  id: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2
          id={id}
          className="scroll-mt-16 text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function typeCatalogLines(product: Product): string[] {
  switch (product.type) {
    case "ecommerce": {
      const lines: string[] = [product.metadata.fulfillmentKind];
      if (product.sku) lines.push(`SKU ${product.sku}`);
      if (product.category) lines.push(product.category);
      if (product.variants?.length) {
        lines.push(
          `${product.variants.length} variant${product.variants.length === 1 ? "" : "s"}`,
        );
      }
      if (product.collections?.length) {
        lines.push(product.collections.map((c) => c.title).join(" · "));
      }
      return lines;
    }
    case "mobile_app": {
      const lines = [product.metadata.platforms.join(" · ")];
      if (product.metadata.category) lines.push(product.metadata.category);
      if (product.metadata.bundleId) lines.push(product.metadata.bundleId);
      if (product.metadata.appStoreUrl) lines.push(product.metadata.appStoreUrl);
      if (product.metadata.playStoreUrl) lines.push(product.metadata.playStoreUrl);
      return lines;
    }
    case "website": {
      const lines = [product.metadata.url];
      if (product.metadata.primaryDomain) lines.push(product.metadata.primaryDomain);
      if (product.metadata.siteKind) lines.push(product.metadata.siteKind);
      return lines;
    }
    case "brick_and_mortar": {
      const lines = [
        product.metadata.addressLine1,
        `${product.metadata.city}, ${product.metadata.region} ${product.metadata.postalCode}`,
        product.metadata.country,
      ];
      if (product.metadata.hours) lines.push(product.metadata.hours);
      if (product.metadata.phone) lines.push(product.metadata.phone);
      if (product.metadata.websiteUrl) lines.push(product.metadata.websiteUrl);
      return lines;
    }
    case "event": {
      const lines = [product.metadata.venue, product.metadata.startAt];
      if (product.metadata.endAt) lines.push(`Ends ${product.metadata.endAt}`);
      if (product.metadata.address) lines.push(product.metadata.address);
      if (product.metadata.capacity) {
        lines.push(`Capacity ${product.metadata.capacity}`);
      }
      if (product.metadata.ticketUrl) lines.push(product.metadata.ticketUrl);
      return lines;
    }
    case "election": {
      const lines = [
        product.metadata.candidateName,
        `${product.metadata.office} · ${product.metadata.jurisdiction}`,
        product.metadata.electionDate,
      ];
      if (product.metadata.party) lines.push(product.metadata.party);
      return lines;
    }
  }
}

export function ProductStreamKnow({
  product,
  intelligence,
}: {
  product: Product;
  intelligence: ProductIntelligence | null;
}) {
  const { setComposePrefill } = useAgentContext();
  const catalog = typeCatalogLines(product);

  return (
    <section aria-labelledby="know" className="space-y-4">
      <StreamHeading
        id="know"
        title="Know"
        description="Identity and intelligence — the source of truth for this product."
        action={
          !intelligence?.positioning ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setComposePrefill(
                  `Propose positioning intelligence for ${product.title}: audience, value props, objections, and tone.`,
                )
              }
            >
              Build intelligence
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setComposePrefill(
                  `Refine the positioning and audience for ${product.title}.`,
                )
              }
            >
              Refine with agent
            </Button>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card/30 p-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Identity
          </h3>
          <p className="mt-2 text-sm font-medium">{product.title}</p>
          <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
            {product.description || "—"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline" className="text-[10px] uppercase">
              {productTypeLabel(product.type)}
            </Badge>
            <Badge variant="outline" className="text-[10px] uppercase">
              {product.status}
            </Badge>
          </div>
          {catalog.length > 0 ? (
            <ul className="mt-3 space-y-1 font-mono text-[11px] text-muted-foreground">
              {catalog.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="rounded-lg border border-border bg-card/30 p-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Intelligence
          </h3>
          {!intelligence?.positioning ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No intelligence yet. Ask the agent to draft positioning, audience,
              and tone.
            </p>
          ) : (
            <div className="mt-2 space-y-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Positioning
                </p>
                <p className="mt-1 text-sm leading-relaxed">
                  {intelligence.positioning}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Audience
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {intelligence.audience || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Tone
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {intelligence.tone || "—"}
                  </p>
                </div>
              </div>
              {intelligence.valueProps.length > 0 ? (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Value props
                  </p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm">
                    {intelligence.valueProps.map((v) => (
                      <li key={v}>{v}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {intelligence.objections.length > 0 ? (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Objections
                  </p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
                    {intelligence.objections.map((v) => (
                      <li key={v}>{v}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {product.type === "ecommerce" && product.variants && product.variants.length > 0 ? (
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Variants
          </h3>
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
        </div>
      ) : null}
    </section>
  );
}

export function ProductStreamDecide({
  awaitingInsights,
  productTitle,
}: {
  awaitingInsights: Insight[];
  productTitle: string;
}) {
  const { setComposePrefill } = useAgentContext();
  const empty = awaitingInsights.length === 0;

  return (
    <section aria-labelledby="decide" className="space-y-4">
      <StreamHeading
        id="decide"
        title="Decide"
        description="Review queue — accept or reject insights for this product."
        action={
          empty ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setComposePrefill(
                  `Propose the next marketing insight for ${productTitle}.`,
                )
              }
            >
              Ask for an insight
            </Button>
          ) : null
        }
      />

      {empty ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          Nothing needs your review. Use the agent to generate positioning, ad
          copy, campaign concepts, or listing updates as insights.
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {awaitingInsights.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              productTitle={productTitle}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function ProductStreamRun({
  product,
  campaigns,
  creatives,
  insights,
  plan = "free",
}: {
  product: Product;
  campaigns: Campaign[];
  creatives: Creative[];
  insights: Insight[];
  plan?: WorkspacePlan;
}) {
  const { setComposePrefill } = useAgentContext();
  const ents = getEntitlements(plan);
  const campaignsLocked = !ents.canSpendAndLaunch;

  const acceptedDeliverables = insights.filter(
    (i) => i.status === "accepted" && isApplyDeliverableAction(i.action),
  );

  return (
    <section aria-labelledby="run" className="space-y-4">
      <StreamHeading
        id="run"
        title="Run"
        description="Campaigns and creatives — deep work opens in dedicated workspaces."
        action={
          campaignsLocked ? (
            <UpgradeButton size="sm">Unlock campaigns</UpgradeButton>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setComposePrefill(
                  `Draft a campaign concept for ${product.title} and run create_campaign when ready.`,
                )
              }
            >
              New campaign
            </Button>
          )
        }
      />

      {campaignsLocked ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
          <p className="text-sm font-medium">Campaigns are locked</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Free workspaces can brainstorm campaign concepts with the agent, but
            saving and launching campaigns requires Growth or Pro.
          </p>
          <UpgradeButton size="sm" className="mt-4">
            Upgrade
          </UpgradeButton>
        </div>
      ) : campaigns.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          No campaigns yet.
          {ents.maxCampaignsPerProduct != null
            ? ` (${ents.maxCampaignsPerProduct} max per product on ${ents.name})`
            : null}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {campaigns.map((campaign) => {
            const linkedCreatives = creatives.filter((c) =>
              c.campaignIds.includes(campaign.id),
            );
            const linkedInsights = acceptedDeliverables.filter((insight) =>
              deliverableCampaignIds(insight.action).includes(campaign.id),
            );
            return (
              <li key={campaign.id} className="space-y-3 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{campaign.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {campaign.objective}
                    </p>
                    <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                      {campaign.channels.join(" · ") || "No channels"}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {campaign.status}
                  </Badge>
                </div>
                {linkedCreatives.length === 0 && linkedInsights.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    No creatives linked yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {linkedCreatives.map((creative) => (
                      <CreativeCard
                        key={creative.id}
                        creative={creative}
                        compact
                        pollWhileGenerating={false}
                      />
                    ))}
                    {linkedInsights.map((insight) => (
                      <InsightCard
                        key={insight.id}
                        insight={insight}
                        compact
                        pollWhileGenerating={false}
                      />
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Creatives
          </h3>
          <Link
            href="/creatives"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            View all
          </Link>
        </div>
        {creatives.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No video creatives yet. Start one from the header or ask the agent.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {creatives.slice(0, 6).map((creative) => (
              <CreativeCard
                key={creative.id}
                creative={creative}
                pollWhileGenerating={false}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function ProductStreamImprove({
  product,
  goals,
  insights,
  performance,
  plan = "free",
}: {
  product: Product;
  goals: Goal[];
  insights: Insight[];
  performance: PerformancePoint[];
  plan?: WorkspacePlan;
}) {
  const { setComposePrefill } = useAgentContext();
  const ents = getEntitlements(plan);
  const hasLivePerformance = performance.length > 0;
  const resolvedInsights = insights.filter(
    (i) =>
      i.status === "accepted" ||
      i.status === "rejected" ||
      i.status === "failed",
  );
  const activeGoals = goals.filter((g) => g.status === "active");

  return (
    <section aria-labelledby="improve" className="space-y-4">
      <StreamHeading
        id="improve"
        title="Improve"
        description="Goals, performance, and insight history for this product."
        action={
          ents.hasInsights ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setComposePrefill(
                  `Generate an insight for ${product.title} based on current goals and campaigns.`,
                )
              }
            >
              Generate insight
            </Button>
          ) : (
            <UpgradeButton size="sm">Unlock insights</UpgradeButton>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card/30 p-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Goals
          </h3>
          {activeGoals.length === 0 ? (
            <div className="mt-2 space-y-2">
              <p className="text-sm text-muted-foreground">
                No active goals for this product.
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setComposePrefill(
                    `Create a product-scoped goal for ${product.title}.`,
                  )
                }
              >
                Set a goal
              </Button>
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {activeGoals.map((goal) => (
                <li key={goal.id} className="py-2 first:pt-0 last:pb-0">
                  <p className="text-sm font-medium">{goal.title}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {goal.metric.toUpperCase()}
                    {goal.targetValue != null
                      ? ` · ${goal.targetValue}${goal.targetUnit ?? ""}`
                      : ""}
                    {` · ${goal.horizon}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card/30 p-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Performance
          </h3>
          {hasLivePerformance ? (
            <div className="mt-2 space-y-2">
              <p className="text-sm text-muted-foreground">
                Product-level campaign metrics live at the top of this page.
              </p>
              <Button size="sm" variant="outline" render={<a href="#performance" />}>
                View performance
              </Button>
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="text-sm text-muted-foreground">
                Live product-level performance is not connected yet. Link an ad
                channel to start ingesting results.
              </p>
              <Button
                size="sm"
                variant="outline"
                render={<Link href="/settings/connections" />}
              >
                Connect channels
              </Button>
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Insight history
        </h3>
        {resolvedInsights.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Resolved insights will appear here as a timeline.
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {resolvedInsights.slice(0, 6).map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                productTitle={product.title}
                pollWhileGenerating={false}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function ProductStreamLibrary({ product }: { product: Product }) {
  return (
    <section aria-labelledby="library" className="space-y-4">
      <StreamHeading
        id="library"
        title="Library"
        description="Assets and listing truth as marketing sees them."
      />

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Images
        </h3>
        {product.images.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            No images yet. Add them on create/import, or ask the agent for a
            listing update when write-back is available.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {product.images.map((src, index) => (
              <div
                key={`${src}-${index}`}
                className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted"
              >
                <ProductImage
                  src={src}
                  avgColor={product.imageAvgColors[index]}
                  className="size-full"
                  sizes="160px"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {product.type === "ecommerce" ? (
        <div className="rounded-lg border border-border bg-card/30 p-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Listing snapshot
          </h3>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Title
              </dt>
              <dd className="mt-1 text-sm">{product.title}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Price
              </dt>
              <dd className="mt-1 text-sm">
                {formatMoney(product.price, product.currency)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Description
              </dt>
              <dd className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                {product.description || "—"}
              </dd>
            </div>
          </dl>
          {product.collections && product.collections.length > 0 ? (
            <p className="mt-3 font-mono text-[11px] text-muted-foreground">
              Collections:{" "}
              {product.collections.map((c) => c.title).join(" · ")}
            </p>
          ) : null}
          <p className="mt-3 text-[11px] text-muted-foreground">
            Accepting a listing_update insight applies title and description
            here. Pushing back to the storefront is not available yet.
          </p>
        </div>
      ) : null}
    </section>
  );
}
