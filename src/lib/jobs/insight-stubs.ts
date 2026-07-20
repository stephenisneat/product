import type { Goal, InsightAction, JobRun } from "@/domain";

export const MAX_AWAITING_REVIEW_INSIGHTS = 3;
export const HEARTBEAT_MIN_HOURS_BETWEEN_INSIGHTS = 12;

export type StubInsightContent = {
  title: string;
  summary: string;
  rationale: string;
  goalId: string | null;
  productId: string | null;
  action: InsightAction | null;
};

function formatGoalTarget(goal: Goal): string {
  if (goal.targetValue == null) return goal.title;
  const unit = goal.targetUnit?.trim() || "";
  return `${goal.title} (${goal.targetValue}${unit})`;
}

export function buildStubInsight(opts: {
  goals: Goal[];
  sourceJob?: JobRun | null;
  revisionFeedback?: string | null;
  productId?: string | null;
}): StubInsightContent {
  const feedback = opts.revisionFeedback?.trim();
  const activeGoals = opts.goals.filter((g) => g.status === "active");
  const productGoals = opts.productId
    ? activeGoals.filter((g) => g.productId === opts.productId)
    : [];
  const primaryGoal =
    productGoals[0] ??
    activeGoals.find((g) => g.scope === "product") ??
    activeGoals[0] ??
    null;

  if (feedback) {
    const base = buildStubInsight({
      goals: opts.goals,
      sourceJob: opts.sourceJob,
      productId: opts.productId,
    });
    return {
      ...base,
      title: `Revised: ${base.title}`,
      summary: `${base.summary} Incorporating feedback: ${feedback}`,
      rationale: `${base.rationale}\n\nRevision notes: ${feedback}`,
    };
  }

  if (!primaryGoal) {
    return {
      title: "Set a measurable goal",
      summary:
        "No active goals yet. Define a product or workspace goal so insights can stay focused.",
      rationale:
        "Insights work best when they optimize toward a concrete target (ROAS, revenue, CAC, or a custom KPI).",
      goalId: null,
      productId: opts.productId ?? null,
      action: {
        type: "open_chat",
        label: "Define a goal in chat",
        payload: {
          prefill:
            "Help me set an active goal for this workspace. Suggest a metric, target, and horizon.",
        },
      },
    };
  }

  const goalLabel = formatGoalTarget(primaryGoal);
  const productId = opts.productId ?? primaryGoal.productId;

  if (opts.sourceJob) {
    const job = opts.sourceJob;
    const succeeded = job.status === "succeeded";
    if (job.type === "create_campaign") {
      return {
        title: succeeded
          ? "Amplify the new campaign"
          : "Recover from campaign job failure",
        summary: succeeded
          ? `A draft campaign was created. Align creative and spend with "${goalLabel}".`
          : `Campaign creation failed. Revisit the brief against "${goalLabel}" before retrying.`,
        rationale: succeeded
          ? `Job ${job.id.slice(0, 8)} succeeded. Next step: attach a video creative or ad copy that directly supports ${goalLabel}.`
          : `Job ${job.id.slice(0, 8)} failed${job.error ? `: ${job.error}` : ""}. Clear the blocker, then retry with a sharper objective tied to ${goalLabel}.`,
        goalId: primaryGoal.id,
        productId,
        action: succeeded
          ? {
              type: "create_video_creative",
              label: "Start a video creative",
              payload: {
                productId: productId ?? undefined,
                title: `Creative for ${primaryGoal.title}`,
                brief: `Support the goal: ${goalLabel}. Keep the hook product-led and measurable.`,
              },
            }
          : {
              type: "open_chat",
              label: "Diagnose in chat",
              payload: {
                prefill: `The create_campaign job (${job.id}) failed${job.error ? `: ${job.error}` : ""}. Help me fix it and retry toward ${goalLabel}.`,
              },
            },
      };
    }

    if (job.type.startsWith("generate_creative_")) {
      return {
        title: succeeded
          ? "Review creative against the goal"
          : "Creative generation needs attention",
        summary: succeeded
          ? `A creative stage finished. Check that the output still serves "${goalLabel}".`
          : `Creative generation failed while pursuing "${goalLabel}".`,
        rationale: succeeded
          ? `Accept the stage if it advances ${goalLabel}; otherwise revise with clearer goal language.`
          : `Job ${job.id.slice(0, 8)} failed${job.error ? `: ${job.error}` : ""}. Resubmit or adjust the brief.`,
        goalId: primaryGoal.id,
        productId,
        action: {
          type: "open_chat",
          label: "Discuss in chat",
          payload: {
            prefill: succeeded
              ? `Review the latest creative stage against goal "${goalLabel}" and suggest revisions if needed.`
              : `Creative job ${job.id} failed. Help me recover toward ${goalLabel}.`,
          },
        },
      };
    }
  }

  // Heartbeat / generic
  if (primaryGoal.metric === "roas" || primaryGoal.metric === "revenue") {
    return {
      title: `Push toward ${goalLabel}`,
      summary: `Launch or refresh a campaign concept aimed at ${primaryGoal.metric.toUpperCase()}.`,
      rationale: `Active goal "${primaryGoal.title}" (${primaryGoal.horizon}) has no recent linked campaign action. A focused draft campaign keeps momentum.`,
      goalId: primaryGoal.id,
      productId,
      action: productId
        ? {
            type: "create_campaign",
            label: "Create draft campaign",
            payload: {
              productId,
              name: `${primaryGoal.title} push`,
              objective: `Optimize for ${goalLabel}`,
            },
          }
        : {
            type: "open_chat",
            label: "Plan in chat",
            payload: {
              prefill: `Propose a campaign plan to hit ${goalLabel}.`,
            },
          },
    };
  }

  return {
    title: `Next move for ${primaryGoal.title}`,
    summary: `Propose fresh ad copy that reinforces ${goalLabel}.`,
    rationale: `Workspace heartbeat: keep creative messaging aligned with the active ${primaryGoal.horizon} goal.`,
    goalId: primaryGoal.id,
    productId,
    action: productId
      ? {
          type: "propose_artifact",
          label: "Propose ad copy",
          payload: {
            productId,
            type: "ad_copy",
            title: `Copy for ${primaryGoal.title}`,
            summary: `Draft messaging toward ${goalLabel}`,
            payload: {
              headlines: [`Hit ${goalLabel}`],
              primaryText: `Built to help you reach ${goalLabel}.`,
              cta: "Shop now",
            },
          },
        }
      : {
          type: "open_chat",
          label: "Brainstorm in chat",
          payload: {
            prefill: `Suggest the next marketing move for goal "${goalLabel}".`,
          },
        },
  };
}
