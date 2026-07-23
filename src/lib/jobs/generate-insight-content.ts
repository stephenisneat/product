import { generateText, Output } from "ai";
import { z } from "zod";
import type { Goal, InsightAction, InsightKind, JobRun, Product } from "@/domain";
import {
  insightActionSchema,
  insightKindSchema,
} from "@/domain";
import { getGatewayChatModel } from "@/lib/ai/models";
import { buildStubInsight } from "@/lib/jobs/insight-stubs";
import { hasAiGateway } from "@/lib/mode";
import { chargeAiUsage } from "@/lib/wallet/gate";
import type { PerformanceQueryResult } from "@/repositories/performance";

export const INSIGHT_TEXT_MODEL = "openai/gpt-4.1-mini";

export type InsightContent = {
  title: string;
  summary: string;
  rationale: string;
  kind: InsightKind;
  goalId: string | null;
  productId: string | null;
  action: InsightAction | null;
};

const generatedInsightSchema = z.object({
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(600),
  rationale: z.string().min(1).max(2000),
  kind: insightKindSchema,
  goalId: z.string().uuid().nullable(),
  productId: z.string().nullable(),
  action: insightActionSchema.nullable(),
});

function formatGoals(goals: Goal[]): string {
  if (goals.length === 0) return "None";
  return goals
    .map((g) => {
      const target =
        g.targetValue != null
          ? ` target=${g.targetValue}${g.targetUnit ?? ""}`
          : "";
      return `- ${g.id} [${g.metric}/${g.horizon}/${g.status}] ${g.title}${target}${g.productId ? ` product=${g.productId}` : ""}`;
    })
    .join("\n");
}

function formatPerformance(result: PerformanceQueryResult | null): string {
  if (!result || result.campaignCount === 0) {
    return "No synced campaign performance yet.";
  }
  const t = result.totals;
  const top = result.breakdown.slice(0, 5)
    .map(
      (row) =>
        `- ${row.label}: spend=${row.spend.toFixed(2)} revenue=${row.revenue.toFixed(2)} conv=${row.conversions} clicks=${row.clicks}`,
    )
    .join("\n");
  return `Campaigns=${result.campaignCount}
Totals: impressions=${t.impressions} clicks=${t.clicks} spend=${t.spend.toFixed(2)} conversions=${t.conversions} revenue=${t.revenue.toFixed(2)}
Top breakdown:
${top || "(none)"}`;
}

function formatSourceJob(job: JobRun | null | undefined): string {
  if (!job) return "None";
  return `type=${job.type} status=${job.status} id=${job.id}${job.error ? ` error=${job.error}` : ""}`;
}

function formatProduct(product: Product | null): string {
  if (!product) return "None";
  return `${product.title} (${product.id})${product.category ? ` category=${product.category}` : ""}`;
}

/** AI insight when gateway is configured; deterministic stub otherwise. */
export async function generateInsightContent(opts: {
  goals: Goal[];
  sourceJob?: JobRun | null;
  revisionFeedback?: string | null;
  productId?: string | null;
  product?: Product | null;
  performance?: PerformanceQueryResult | null;
  workspaceId: string;
  userId: string | null;
}): Promise<InsightContent> {
  const fallback = buildStubInsight({
    goals: opts.goals,
    sourceJob: opts.sourceJob,
    revisionFeedback: opts.revisionFeedback,
    productId: opts.productId,
  });

  if (!hasAiGateway()) {
    return fallback;
  }

  try {
    const result = await generateText({
      model: INSIGHT_TEXT_MODEL,
      output: Output.object({ schema: generatedInsightSchema }),
      system: `You are Product Agent's marketing strategist. Produce one actionable insight for a commerce workspace.

Rules:
- Be specific and grounded in the provided goals, jobs, product, and performance data.
- Prefer opportunities or blockers over vague ideas when data supports it.
- Use kind "setup" only when no active goals exist.
- Actions must be one of: create_campaign, apply_deliverable, create_video_creative, open_chat.
- For create_campaign / create_video_creative / apply_deliverable, include required payload fields (productId when known).
- Keep title short; summary is the user-facing recommendation; rationale explains why.
- If revision feedback is present, incorporate it explicitly.
- Never invent performance metrics that contradict the provided totals.`,
      prompt: `Draft the next insight.

Active goals:
${formatGoals(opts.goals.filter((g) => g.status === "active"))}

Product:
${formatProduct(opts.product ?? null)}

Requested productId: ${opts.productId ?? "null"}

Source job:
${formatSourceJob(opts.sourceJob)}

Performance (synced):
${formatPerformance(opts.performance ?? null)}

Revision feedback:
${opts.revisionFeedback?.trim() || "None"}

Return goalId only if it matches an active goal id above (or null).`,
    });

    if (opts.userId) {
      const gatewayModel = await getGatewayChatModel(INSIGHT_TEXT_MODEL).catch(
        () => null,
      );
      await chargeAiUsage({
        workspaceId: opts.workspaceId,
        userId: opts.userId,
        inputTokens: result.usage.inputTokens ?? 0,
        outputTokens: result.usage.outputTokens ?? 0,
        model: INSIGHT_TEXT_MODEL,
        tokenPricing: gatewayModel?.pricing ?? null,
      });
    }

    const content = result.output;
    if (!content) return fallback;

    const activeGoalIds = new Set(
      opts.goals.filter((g) => g.status === "active").map((g) => g.id),
    );
    if (content.goalId && !activeGoalIds.has(content.goalId)) {
      content.goalId = fallback.goalId;
    }
    if (!content.productId && opts.productId) {
      content.productId = opts.productId;
    }

    return content;
  } catch (error) {
    console.error(
      "AI insight generation failed; using stub:",
      error instanceof Error ? error.message : error,
    );
    return fallback;
  }
}
