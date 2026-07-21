import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import {
  canManageMembers,
  getActiveWorkspace,
} from "@/lib/auth/workspace";
import {
  AdChannelConnectionsPanel,
  AMAZON_ADS_PANEL_CONFIG,
  META_ADS_PANEL_CONFIG,
  TIKTOK_ADS_PANEL_CONFIG,
  X_ADS_PANEL_CONFIG,
} from "@/features/channels/ad-channel-connections-panel";
import { GoogleAdsConnectionsPanel } from "@/features/channels/google-ads-connections-panel";

const OTHER_SECTIONS = [
  {
    title: "Commerce & APIs",
    description:
      "Link Shopify, WooCommerce, BigCommerce, Amazon, Squarespace, and other commerce platforms to sync products and catalog data.",
  },
  {
    title: "MCP",
    description:
      "Manage Model Context Protocol servers available to this workspace.",
  },
  {
    title: "Webhooks",
    description:
      "Configure outbound webhooks for events in this workspace.",
  },
] as const;

const AD_PANEL_CONFIGS = [
  META_ADS_PANEL_CONFIG,
  TIKTOK_ADS_PANEL_CONFIG,
  AMAZON_ADS_PANEL_CONFIG,
  X_ADS_PANEL_CONFIG,
] as const;

function PanelFallback({ title }: { title: string }) {
  return (
    <section className="rounded-lg border border-border px-4 py-5">
      <h2 className="text-sm font-medium">{title}</h2>
      <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
    </section>
  );
}

export default async function ConnectionsSettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/settings/connections");
  }

  const active = await getActiveWorkspace();
  if (!active) {
    redirect("/");
  }

  const canManage = canManageMembers(active.role);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Connections
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Channels, APIs, MCP servers, and webhooks for {active.workspace.name}.
        </p>
      </div>

      <div className="space-y-4">
        <Suspense fallback={<PanelFallback title="Google Ads" />}>
          <GoogleAdsConnectionsPanel canManage={canManage} />
        </Suspense>

        {AD_PANEL_CONFIGS.map((config) => (
          <Suspense key={config.queryParam} fallback={<PanelFallback title={config.name} />}>
            <AdChannelConnectionsPanel canManage={canManage} config={config} />
          </Suspense>
        ))}

        <section className="rounded-lg border border-dashed border-border px-4 py-5">
          <h2 className="text-sm font-medium">Other channels</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pinterest and additional retail media connections are coming soon.
          </p>
        </section>

        {OTHER_SECTIONS.map((section) => (
          <section
            key={section.title}
            className="rounded-lg border border-dashed border-border px-4 py-5"
          >
            <h2 className="text-sm font-medium">{section.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {section.description}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">Coming soon</p>
          </section>
        ))}
      </div>
    </div>
  );
}
