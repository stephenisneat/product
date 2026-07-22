import Link from "next/link";
import type { ReactNode } from "react";
import type {
  Artifact,
  Campaign,
  Creative,
  Goal,
  Insight,
  PerformancePoint,
  ProductIntelligence,
} from "@/domain";
import { cn } from "@/lib/utils";

export type ProductMaturity =
  | "new"
  | "intelligence_ready"
  | "campaigns_active"
  | "needs_attention";

export function resolveProductMaturity({
  intelligence,
  campaigns,
  pendingArtifacts,
  awaitingInsights,
}: {
  intelligence: ProductIntelligence | null;
  campaigns: Campaign[];
  pendingArtifacts: Artifact[];
  awaitingInsights: Insight[];
}): ProductMaturity {
  if (pendingArtifacts.length > 0 || awaitingInsights.length > 0) {
    return "needs_attention";
  }
  if (campaigns.some((c) => c.status === "active" || c.status === "paused")) {
    return "campaigns_active";
  }
  if (intelligence?.positioning) {
    return "intelligence_ready";
  }
  return "new";
}

function PulseCell({
  href,
  label,
  value,
  hint,
  accent,
}: {
  href: string;
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <a
      href={href}
      className={cn(
        "rounded-lg border border-border bg-card/40 px-3 py-3 transition-colors hover:bg-muted/50",
        accent && "border-primary/40 bg-primary/5",
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium tabular-nums">{value}</p>
      {hint ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </a>
  );
}

export function ProductPulse({
  maturity,
  pendingArtifacts,
  awaitingInsights,
  campaigns,
  creatives,
  goals,
  performance,
}: {
  maturity: ProductMaturity;
  pendingArtifacts: Artifact[];
  awaitingInsights: Insight[];
  campaigns: Campaign[];
  creatives: Creative[];
  goals: Goal[];
  performance: PerformancePoint[];
}) {
  const activeCampaigns = campaigns.filter((c) => c.status === "active");
  const pipelineCreatives = creatives.filter(
    (c) =>
      c.status === "generating" ||
      c.status === "revising" ||
      c.status === "awaiting_review",
  );
  const activeGoals = goals.filter((g) => g.status === "active");
  const hasLivePerformance = performance.length > 0;

  const maturityHint =
    maturity === "new"
      ? "Build intelligence to unlock sharper campaigns."
      : maturity === "intelligence_ready"
        ? "Ready for a first campaign or creative."
        : maturity === "needs_attention"
          ? "Something needs your review."
          : "Campaigns are in motion — watch performance.";

  return (
    <section id="pulse" className="scroll-mt-16 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pulse
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{maturityHint}</p>
        </div>
        {!hasLivePerformance ? (
          <ButtonLink href="/settings/connections">Connect channels</ButtonLink>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <PulseCell
          href="#decide"
          label="Open proposals"
          value={String(pendingArtifacts.length)}
          hint={
            pendingArtifacts.length > 0 ? "Review in Decide" : "Inbox clear"
          }
          accent={pendingArtifacts.length > 0}
        />
        <PulseCell
          href="#decide"
          label="Insights"
          value={String(awaitingInsights.length)}
          hint={
            awaitingInsights.length > 0 ? "Awaiting action" : "None pending"
          }
          accent={awaitingInsights.length > 0}
        />
        <PulseCell
          href="#run"
          label="Active campaigns"
          value={String(activeCampaigns.length)}
          hint={`${campaigns.length} total`}
        />
        <PulseCell
          href="#run"
          label="Creatives in pipeline"
          value={String(pipelineCreatives.length)}
          hint={
            pipelineCreatives.length > 0
              ? "Generating or awaiting review"
              : `${creatives.length} total`
          }
          accent={pipelineCreatives.length > 0}
        />
        <PulseCell
          href="#improve"
          label="Goals"
          value={String(activeGoals.length)}
          hint={activeGoals.length > 0 ? "Active" : "None set"}
        />
        <PulseCell
          href="#improve"
          label="Performance"
          value={hasLivePerformance ? "Live" : "—"}
          hint={
            hasLivePerformance
              ? "Channel data available"
              : "Connect channels to ingest"
          }
        />
      </div>
    </section>
  );
}

function ButtonLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-xs font-medium text-foreground underline-offset-4 hover:underline"
    >
      {children}
    </Link>
  );
}
