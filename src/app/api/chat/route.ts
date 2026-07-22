import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  gateway,
  streamText,
  tool,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { z } from "zod";
import type {
  DeliverableType,
  Insight,
  InsightAction,
  Product,
  ProductIntelligence,
  WorkspacePlan,
} from "@/domain";
import {
  adChannelProviderSchema,
  deliverableTypeSchema,
  goalHorizonSchema,
  goalMetricSchema,
  goalScopeSchema,
  goalStatusSchema,
  visualizationKindSchema,
} from "@/domain";
import { resolveChatModel } from "@/lib/ai/models";
import { hasAiGateway } from "@/lib/mode";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import {
  PlanEntitlementError,
  assertHasInsights,
} from "@/lib/billing/gates";
import { normalizeWorkspacePlan } from "@/lib/billing/entitlements";
import {
  normalizeCampaignIds,
  resolveProductCampaignIds,
} from "@/lib/campaigns/associate";
import {
  enqueueCreateCampaignJob,
  resubmitCreativeStage,
  startAudioCreative,
  startDisplayCreative,
  startSearchCreative,
  startVideoCreative,
} from "@/lib/jobs/enqueue";
import {
  createReadyInsight,
  resubmitInsight,
  startInsightGeneration,
} from "@/lib/jobs/enqueue-insight";
import { logServerError, unknownErrorMessage } from "@/lib/errors";
import { hasServiceRole } from "@/lib/supabase/service";
import { assertWalletAllowsAi, chargeAiUsage } from "@/lib/wallet/gate";
import {
  buildCreateVisualizationResult,
  buildCreateVisualizationResultSync,
  inferVisualizationFromPrompt,
} from "@/features/visualizer/create-visualization";
import {
  getCreativeRepository,
  getGoalRepository,
  getPerformanceRepository,
  getProductRepository,
} from "@/repositories";
import { daysAgoUtc, isoDateUtc } from "@/lib/performance/date-range";
const createVisualizationToolSchema = z.object({
  title: z.string().trim().min(1).max(120),
  kind: visualizationKindSchema,
  prompt: z.string().trim().max(500).optional(),
  periodA: z.string().trim().max(40).optional(),
  periodB: z.string().trim().max(40).optional(),
  /** Omit to use page product (product chat); pass null for workspace-wide. */
  productId: z.string().nullable().optional(),
  provider: adChannelProviderSchema.optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const queryPerformanceToolSchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /** Omit to use page product (product chat); pass null for workspace-wide. */
  productId: z.string().nullable().optional(),
  provider: adChannelProviderSchema.optional(),
  groupBy: z.enum(["date", "provider", "campaign"]).optional(),
});

function resolveToolProductId(
  inputProductId: string | null | undefined,
  defaultProductId?: string,
): string | undefined {
  if (inputProductId === null) return undefined;
  return inputProductId ?? defaultProductId;
}
function makeQueryPerformanceTool(
  workspaceId: string,
  defaultProductId?: string,
) {
  return tool({
    description:
      "Query synced campaign performance metrics (impressions, clicks, spend, conversions, revenue) for this workspace. Use for numeric performance questions. Prefer create_visualization when the user wants a chart.",
    inputSchema: queryPerformanceToolSchema,
    execute: async (input) => {
      const endDate = input.endDate ?? isoDateUtc();
      const startDate = input.startDate ?? daysAgoUtc(30);
      try {
        const performance = await getPerformanceRepository();
        const result = await performance.queryPerformance({
          workspaceId,
          productId: resolveToolProductId(input.productId, defaultProductId),
          provider: input.provider,
          startDate,
          endDate,
          groupBy: input.groupBy ?? "date",
        });
        return {
          ok: true,
          startDate,
          endDate,
          ...result,
          message:
            result.campaignCount === 0
              ? "No synced external campaigns yet. Connect an ad account and wait for the daily sync (or trigger a manual sync)."
              : undefined,
        };
      } catch (err) {
        return {
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : "Failed to query performance.",
        };
      }
    },
  });
}

function makeCreateVisualizationTool(
  workspaceId: string,
  defaultProductId?: string,
) {
  return tool({
    description:
      "Create a chart visualization from live synced performance data and open it as a new visualizer tab. Use for performance questions, funnel/flow questions, campaign comparisons (e.g. Q1 vs Q2), or when the user asks to chart or visualize data. Prefer comparison for period-over-period, sankey for funnels/flows, timeseries for trends, bar for channel breakdowns.",
    inputSchema: createVisualizationToolSchema,
    execute: async (input) => {
      return buildCreateVisualizationResult({
        title: input.title,
        kind: input.kind,
        prompt: input.prompt,
        periodA: input.periodA,
        periodB: input.periodB,
        filters: {
          workspaceId,
          productId: resolveToolProductId(input.productId, defaultProductId),
          provider: input.provider,
          startDate: input.startDate,
          endDate: input.endDate,
        },
      });
    },
  });
}
export const runtime = "nodejs";

function buildProductSystemPrompt(
  product: Product,
  intelligence: ProductIntelligence | null,
  plan: WorkspacePlan,
  creativeContext?: {
    id: string;
    title: string;
    kind: string;
    stage: string;
    status: string;
    tab?: string;
  } | null,
): string {
  const creativeBlock = creativeContext
    ? `

The user is editing an existing creative in the creative workspace. Prefer editing this creative over creating a new one.
When they ask for changes to screenplay, world, storyboard, video, or other stage content, call resubmit_creative with creativeId "${creativeContext.id}" and their feedback — do not create a new creative.
Creative:
- id: ${creativeContext.id}
- title: ${creativeContext.title}
- kind: ${creativeContext.kind}
- stage: ${creativeContext.stage}
- status: ${creativeContext.status}
- active tab: ${creativeContext.tab ?? creativeContext.stage}`
    : "";

  return `You are Product Agent, an AI marketing collaborator for commerce products.
You help develop positioning, ad copy, campaign concepts, listing updates, video ad creatives, and display ad creatives.
Workspace plan: ${plan}. Video/display/search/audio creatives and saved campaigns require Growth or Pro.
If the workspace plan is free and a tool returns plan_upgrade_required, tell the user to upgrade and stop asking for creative details.
If the workspace plan is growth or pro, creatives are allowed — treat any earlier plan_upgrade tool errors in this conversation as stale. When the user asks to retry, call create_video_creative, create_display_creative, create_search_creative, or create_audio_creative again; do not invent extra permission restrictions.
Always prefer calling propose_insight with a ready apply_deliverable action when you have concrete copy, positioning, campaign concepts, or listing updates ready for review.
When the user wants to create a campaign (not just a concept proposal), call run_job with type create_campaign.
Keep propose_insight (apply_deliverable) for reviewable copy and concepts; use run_job to actually create a draft campaign.
When the user wants a video ad, call create_video_creative immediately with a short title and brief. If they ask you to invent the concept (e.g. "come up with something"), invent the title and brief yourself and call the tool — do not ask follow-up questions first. Omit campaignIds unless you have real campaign ids from a prior tool result — never invent them.
When the user wants a display ad (static/banner/RDA/image ads), call create_display_creative immediately with a short title and brief. Invent title and brief when asked to invent — do not ask follow-up questions first.
When the user wants a search ad (RSA/Google Search/text ads/keywords), call create_search_creative immediately with a short title and brief. Invent title and brief when asked to invent — do not ask follow-up questions first.
When the user wants an audio ad (podcast/streaming/radio/voice spot), call create_audio_creative immediately with a short title and brief. Invent title and brief when asked to invent — do not ask follow-up questions first.
When the user is revising an existing creative (they mention a creative id or are iterating on feedback), call resubmit_creative with that creativeId — do not create a new creative.
When proposing ad_copy deliverables for campaigns, pass campaignIds with real ids only (or omit / [] for unassigned); never invent.
Goals and auto-generated insights require Pro. When the user states a measurable objective, call create_goal (product or workspace scope). Use list_goals to see active goals. For proactive recommendations without ready content, call propose_insight without action fields; when revising an insight, call resubmit_insight.
Use propose_insight for all reviewable next steps the user Accepts / Rejects / Revises — including concrete marketing deliverables.
When the user asks for performance numbers, totals, or trends as text, call query_performance. When they want a chart/visualization, call create_visualization with an appropriate kind (sankey, timeseries, comparison, or bar) and a clear title. Both tools read synced ad campaign metrics — do not invent figures.
Never invent inventory or prices that contradict the product context.
The user may navigate between pages during a conversation. Treat the product below as the current page context for this turn.

Product:
- Title: ${product.title}
- Handle: ${product.handle}
- Description: ${product.description}
- Price: ${product.price} ${product.currency}
- Channels: ${product.channels.join(", ") || "none"}
- Status: ${product.status}

Current intelligence:
${
  intelligence
    ? JSON.stringify(intelligence, null, 2)
    : "None yet — propose positioning if asked."
}${creativeBlock}`;
}

function buildWorkspaceSystemPrompt(
  products: Product[],
  plan: WorkspacePlan,
): string {
  const catalog =
    products.length === 0
      ? "No products in the workspace yet."
      : products
          .map(
            (p) =>
              `- id: ${p.id} | ${p.title} | status: ${p.status} | price: ${p.price} ${p.currency} | channels: ${p.channels.join(", ") || "none"}`,
          )
          .join("\n");

  return `You are Product Agent, an AI marketing collaborator for a commerce workspace.
The user is chatting at the workspace (catalog) level, not a single product page.
Help prioritize work, compare products, and propose marketing insights for specific products.
Workspace plan: ${plan}. Video/display/search/audio creatives and saved campaigns require Growth or Pro.
If the workspace plan is free and a tool returns plan_upgrade_required, tell the user to upgrade and stop asking for creative details.
If the workspace plan is growth or pro, creatives are allowed — treat any earlier plan_upgrade tool errors in this conversation as stale. When the user asks to retry, call create_video_creative, create_display_creative, create_search_creative, or create_audio_creative again; do not invent extra permission restrictions.
When proposing reviewable copy or concepts, call propose_insight with productId from the catalog and a ready apply_deliverable action.
When the user wants to create a campaign for a product, call run_job with type create_campaign and that productId.
Keep propose_insight (apply_deliverable) for reviewable copy and concepts; use run_job to create a draft campaign.
When the user wants a video ad, call create_video_creative immediately with productId from the catalog (match @mentions to catalog ids), plus a short title and brief. If they ask you to invent the concept, invent title and brief yourself and call the tool — do not ask follow-up questions first. Omit campaignIds unless you have real campaign ids from a prior tool result — never invent them.
When the user wants a display ad (static/banner/RDA/image ads), call create_display_creative immediately with productId from the catalog plus title and brief.
When the user wants a search ad (RSA/Google Search/text ads/keywords), call create_search_creative immediately with productId from the catalog plus title and brief.
When the user wants an audio ad (podcast/streaming/radio/voice spot), call create_audio_creative immediately with productId from the catalog plus title and brief.
When the user is revising an existing creative, call resubmit_creative with that creativeId — do not create a new creative.
Goals and auto-generated insights require Pro. When the user states a measurable objective, call create_goal. Use list_goals to inspect goals. For proactive recommendations without ready content, call propose_insight without action fields; when revising, call resubmit_insight.
When the user asks for performance numbers, totals, or trends as text, call query_performance. When they want a chart/visualization, call create_visualization with an appropriate kind (sankey, timeseries, comparison, or bar) and a clear title. Both tools read synced ad campaign metrics — do not invent figures.
Never invent inventory or prices that contradict the catalog.
The user may navigate between pages during a conversation. Treat this workspace context as the current page for this turn.

Workspace catalog:
${catalog}`;
}

async function createDeliverableInsight(input: {
  workspaceId: string;
  productId: string;
  campaignId?: string | null;
  campaignIds?: string[];
  type: DeliverableType;
  title: string;
  summary: string;
  rationale?: string;
  payload: Record<string, unknown>;
  userId: string;
}): Promise<Insight> {
  const campaignIds = await resolveProductCampaignIds(
    input.productId,
    normalizeCampaignIds({
      campaignIds: input.campaignIds,
      campaignId: input.campaignId,
    }),
  );

  const labels: Record<DeliverableType, string> = {
    positioning: "Apply positioning",
    ad_copy: "Apply ad copy",
    campaign_concept: "Apply campaign concept",
    listing_update: "Apply listing update",
  };

  const action: InsightAction = {
    type: "apply_deliverable",
    label: labels[input.type],
    payload: {
      productId: input.productId,
      type: input.type,
      title: input.title,
      summary: input.summary,
      campaignIds,
      payload: input.payload,
    },
  };

  return createReadyInsight({
    workspaceId: input.workspaceId,
    productId: input.productId,
    campaignId: input.campaignId ?? null,
    createdBy: input.userId,
    title: input.title,
    summary: input.summary,
    rationale: input.rationale ?? "",
    action,
  });
}

function lastUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || message.role !== "user") continue;
    if (!Array.isArray(message.parts)) continue;
    return message.parts
      .filter(
        (p): p is { type: "text"; text: string } =>
          p.type === "text" && typeof (p as { text?: string }).text === "string",
      )
      .map((p) => p.text)
      .join("");
  }
  return "";
}

function writeVisualizationToolEvents(
  write: (chunk: string) => void,
  prompt: string,
): { title: string; href: string } | null {
  const inferred = inferVisualizationFromPrompt(prompt);
  if (!inferred) return null;

  const result = buildCreateVisualizationResultSync({
    title: inferred.title,
    kind: inferred.kind,
    prompt,
    periodA: inferred.periodA,
    periodB: inferred.periodB,
  });
  const toolCallId = `call_${crypto.randomUUID().slice(0, 8)}`;
  const input = {
    title: inferred.title,
    kind: inferred.kind,
    prompt,
    periodA: inferred.periodA,
    periodB: inferred.periodB,
  };

  write(
    `data: ${JSON.stringify({
      type: "tool-input-start",
      toolCallId,
      toolName: "create_visualization",
    })}\n\n`,
  );
  write(
    `data: ${JSON.stringify({
      type: "tool-input-available",
      toolCallId,
      toolName: "create_visualization",
      input,
    })}\n\n`,
  );
  write(
    `data: ${JSON.stringify({
      type: "tool-output-available",
      toolCallId,
      output: result,
    })}\n\n`,
  );

  return { title: result.visualization.title, href: result.href };
}

function offlineProductStreamResponse(
  product: Product,
  workspaceId: string,
  userId: string,
  messages: UIMessage[] = [],
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const write = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      const userPrompt = lastUserText(messages);

      write(`data: ${JSON.stringify({ type: "start" })}\n\n`);

      const viz = writeVisualizationToolEvents(write, userPrompt);
      if (viz) {
        const messageId = `msg_${crypto.randomUUID().slice(0, 8)}`;
        const text = `Created a visualization for that question: "${viz.title}". Opening it in the visualizer.`;
        write(
          `data: ${JSON.stringify({ type: "text-start", id: messageId })}\n\n`,
        );
        for (const word of text.split(/(\s+)/)) {
          write(
            `data: ${JSON.stringify({ type: "text-delta", id: messageId, delta: word })}\n\n`,
          );
          await new Promise((r) => setTimeout(r, 12));
        }
        write(
          `data: ${JSON.stringify({ type: "text-end", id: messageId })}\n\n`,
        );
        write(`data: ${JSON.stringify({ type: "finish" })}\n\n`);
        write("data: [DONE]\n\n");
        controller.close();
        return;
      }

      const text =
        `Reviewing ${product.title}. I'll draft positioning and Meta ad copy as insights for your approval.\n\n` +
        `Creating two proposals now…`;

      const messageId = `msg_${crypto.randomUUID().slice(0, 8)}`;
      write(
        `data: ${JSON.stringify({ type: "text-start", id: messageId })}\n\n`,
      );

      for (const word of text.split(/(\s+)/)) {
        write(
          `data: ${JSON.stringify({ type: "text-delta", id: messageId, delta: word })}\n\n`,
        );
        await new Promise((r) => setTimeout(r, 12));
      }

      write(`data: ${JSON.stringify({ type: "text-end", id: messageId })}\n\n`);

      if (hasServiceRole()) {
        try {
          await createDeliverableInsight({
            workspaceId,
            productId: product.id,
            type: "positioning",
            title: `${product.title} — refined positioning`,
            summary: "Positioning proposal ready for review.",
            payload: {
              positioning: `${product.title} is the premium everyday choice for customers who want durable design without disposable waste.`,
              audience:
                "Design-conscious shoppers aged 25–45 discovering elevated essentials",
              valueProps: [
                "Built for daily use",
                "Distinctive finishes",
                "Clear quality signal at shelf",
              ],
              objections: ["Premium price vs commodity alternatives"],
              tone: "Confident, restrained, product-led",
            },
            userId,
          });

          await createDeliverableInsight({
            workspaceId,
            productId: product.id,
            type: "ad_copy",
            title: `${product.title} — Meta ad draft`,
            summary: "Primary text and headline for paid social.",
            payload: {
              headline: `Meet ${product.title}`,
              primaryText: `${product.description.slice(0, 140)} Built to last. Ready when you are.`,
              cta: "Shop now",
              channel: "meta",
            },
            userId,
          });
        } catch {
          // Offline stub should still complete the stream.
        }
      }

      write(
        `data: ${JSON.stringify({
          type: "text-delta",
          id: messageId,
          delta:
            "\n\nInsights are ready in Decide for review. Accept to apply them.",
        })}\n\n`,
      );

      write(`data: ${JSON.stringify({ type: "finish" })}\n\n`);
      write("data: [DONE]\n\n");
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "x-vercel-ai-ui-message-stream": "v1",
    },
  });
}

function offlineWorkspaceStreamResponse(
  products: Product[],
  messages: UIMessage[] = [],
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const write = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      const userPrompt = lastUserText(messages);

      write(`data: ${JSON.stringify({ type: "start" })}\n\n`);

      const viz = writeVisualizationToolEvents(write, userPrompt);
      if (viz) {
        const messageId = `msg_${crypto.randomUUID().slice(0, 8)}`;
        const text = `Created a visualization for that question: "${viz.title}". Opening it in the visualizer.`;
        write(
          `data: ${JSON.stringify({ type: "text-start", id: messageId })}\n\n`,
        );
        for (const word of text.split(/(\s+)/)) {
          write(
            `data: ${JSON.stringify({ type: "text-delta", id: messageId, delta: word })}\n\n`,
          );
          await new Promise((r) => setTimeout(r, 12));
        }
        write(
          `data: ${JSON.stringify({ type: "text-end", id: messageId })}\n\n`,
        );
        write(`data: ${JSON.stringify({ type: "finish" })}\n\n`);
        write("data: [DONE]\n\n");
        controller.close();
        return;
      }

      const count = products.length;
      const sample = products
        .slice(0, 3)
        .map((p) => p.title)
        .join(", ");
      const text =
        count === 0
          ? "Your workspace has no products yet. Add a product from the catalog, then ask me to develop positioning or ad copy."
          : `Workspace view: ${count} product${count === 1 ? "" : "s"}${sample ? ` (e.g. ${sample})` : ""}. Open a product for focused proposals, or tell me which product to work on and what you need.`;

      const messageId = `msg_${crypto.randomUUID().slice(0, 8)}`;
      write(
        `data: ${JSON.stringify({ type: "text-start", id: messageId })}\n\n`,
      );

      for (const word of text.split(/(\s+)/)) {
        write(
          `data: ${JSON.stringify({ type: "text-delta", id: messageId, delta: word })}\n\n`,
        );
        await new Promise((r) => setTimeout(r, 12));
      }

      write(`data: ${JSON.stringify({ type: "text-end", id: messageId })}\n\n`);
      write(`data: ${JSON.stringify({ type: "finish" })}\n\n`);
      write("data: [DONE]\n\n");
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "x-vercel-ai-ui-message-stream": "v1",
    },
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    messages?: UIMessage[];
    productId?: string;
    creativeId?: string;
    creativeTab?: string;
    model?: string;
  };

  const productId = body.productId;
  const creativeId = body.creativeId;
  const creativeTab = body.creativeTab;
  const productsRepo = await getProductRepository();
  const messages = body.messages ?? [];
  const { modelId: chatModel, model: gatewayModel } = await resolveChatModel(
    body.model,
  );

  if (productId) {
    const product = await productsRepo.getProduct(productId);
    if (!product) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }
    const active = await getActiveWorkspace();
    if (!active || product.workspaceId !== active.workspace.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const intelligence = await productsRepo.getIntelligence(productId);

    let creativeContext: {
      id: string;
      title: string;
      kind: string;
      stage: string;
      status: string;
      tab?: string;
    } | null = null;
    if (creativeId) {
      const creativesRepo = await getCreativeRepository();
      const creative = await creativesRepo.getById(creativeId);
      if (
        creative &&
        creative.workspaceId === active.workspace.id &&
        creative.productId === productId
      ) {
        creativeContext = {
          id: creative.id,
          title: creative.title,
          kind: creative.kind,
          stage: creative.stage,
          status: creative.status,
          tab: creativeTab,
        };
      }
    }

    if (!hasAiGateway()) {
      return offlineProductStreamResponse(
        product,
        active.workspace.id,
        user.id,
        messages,
      );
    }

    const gate = await assertWalletAllowsAi(active.workspace.id);
    if (!gate.ok) return gate.response;

    const plan = normalizeWorkspacePlan(active.workspace.plan);
    const result = streamText({
      model: gateway(chatModel),
      system: buildProductSystemPrompt(
        product,
        intelligence,
        plan,
        creativeContext,
      ),
      messages: await convertToModelMessages(messages),
      providerOptions: {
        gateway: {
          user: user.id,
          tags: [
            "feature:chat",
            "scope:product",
            `model:${chatModel}`,
            ...(creativeId ? ["surface:creative"] : []),
          ],
        },
      },
      onFinish: async ({ usage }) => {
        await chargeAiUsage({
          workspaceId: active.workspace.id,
          userId: user.id,
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
          model: chatModel,
          tokenPricing: gatewayModel?.pricing,
        });
      },
      tools: {
        run_job: tool({
          description:
            "Start a background job. Use type create_campaign to create a draft campaign for the current product. Returns immediately with a jobId; progress appears on /jobs.",
          inputSchema: z.object({
            type: z.literal("create_campaign"),
            name: z.string().trim().min(1).max(120),
            objective: z.string().trim().max(500).optional(),
            channels: z.array(z.string().trim().min(1)).max(20).optional(),
          }),
          execute: async (input) => {
            if (!hasServiceRole()) {
              return {
                ok: false,
                error: "Jobs service is not configured.",
              };
            }
            try {
              const job = await enqueueCreateCampaignJob({
                workspaceId: active.workspace.id,
                createdBy: user.id,
                trigger: "agent",
                input: {
                  productId,
                  name: input.name,
                  objective: input.objective,
                  channels: input.channels,
                },
              });
              return {
                ok: true,
                jobId: job.id,
                message: `Campaign job started. Track it on /jobs (id ${job.id}).`,
              };
            } catch (err) {
              return {
                ok: false,
                error:
                  err instanceof Error ? err.message : "Failed to start job.",
              };
            }
          },
        }),
        create_video_creative: tool({
          description:
            "Start a video ad creative pipeline (screenplay → world → storyboard → video) for the current product. Returns a creativeId; the user reviews each stage with Accept / Reject / Revise. Omit campaignIds unless attaching to existing campaign ids from a prior tool result — never invent campaign ids.",
          inputSchema: z.object({
            title: z.string().trim().min(1).max(120),
            brief: z.string().trim().min(1).max(4000),
            campaignIds: z.array(z.string()).optional(),
            campaignId: z.string().optional(),
          }),
          execute: async (input) => {
            if (!hasServiceRole()) {
              return {
                ok: false,
                error: "Jobs service is not configured.",
              };
            }
            try {
              const { creative, job } = await startVideoCreative({
                workspaceId: active.workspace.id,
                productId,
                campaignIds: input.campaignIds,
                campaignId: input.campaignId ?? null,
                title: input.title,
                brief: input.brief,
                createdBy: user.id,
                trigger: "agent",
                plan,
              });
              return {
                ok: true,
                creativeId: creative.id,
                jobId: job.id,
                href: `/creatives/${creative.id}`,
                message: `Started video creative "${creative.title}". Review it in chat or on /creatives/${creative.id}.`,
              };
            } catch (err) {
              if (err instanceof PlanEntitlementError) {
                return { ok: false, error: err.message, code: err.code };
              }
              logServerError("chat.create_video_creative", err, {
                workspaceId: active.workspace.id,
                productId,
                plan,
              });
              return {
                ok: false,
                error: unknownErrorMessage(
                  err,
                  "Failed to start video creative.",
                ),
              };
            }
          },
        }),
        create_display_creative: tool({
          description:
            "Start a display ad creative pipeline (concept copy → marketing/square images) for the current product. Returns a creativeId; the user reviews each stage with Accept / Reject / Revise. Omit campaignIds unless attaching to existing campaign ids from a prior tool result — never invent campaign ids.",
          inputSchema: z.object({
            title: z.string().trim().min(1).max(120),
            brief: z.string().trim().min(1).max(4000),
            campaignIds: z.array(z.string()).optional(),
            campaignId: z.string().optional(),
          }),
          execute: async (input) => {
            if (!hasServiceRole()) {
              return {
                ok: false,
                error: "Jobs service is not configured.",
              };
            }
            try {
              const { creative, job } = await startDisplayCreative({
                workspaceId: active.workspace.id,
                productId,
                campaignIds: input.campaignIds,
                campaignId: input.campaignId ?? null,
                title: input.title,
                brief: input.brief,
                createdBy: user.id,
                trigger: "agent",
                plan,
              });
              return {
                ok: true,
                creativeId: creative.id,
                jobId: job.id,
                href: `/creatives/${creative.id}`,
                message: `Started display creative "${creative.title}". Review it in chat or on /creatives/${creative.id}.`,
              };
            } catch (err) {
              if (err instanceof PlanEntitlementError) {
                return { ok: false, error: err.message, code: err.code };
              }
              logServerError("chat.create_display_creative", err, {
                workspaceId: active.workspace.id,
                productId,
                plan,
              });
              return {
                ok: false,
                error: unknownErrorMessage(
                  err,
                  "Failed to start display creative.",
                ),
              };
            }
          },
        }),
        create_search_creative: tool({
          description:
            "Start a search ad creative pipeline (RSA copy → keyword themes) for the current product. Returns a creativeId; the user reviews each stage with Accept / Reject / Revise. Omit campaignIds unless attaching to existing campaign ids from a prior tool result — never invent campaign ids.",
          inputSchema: z.object({
            title: z.string().trim().min(1).max(120),
            brief: z.string().trim().min(1).max(4000),
            campaignIds: z.array(z.string()).optional(),
            campaignId: z.string().optional(),
          }),
          execute: async (input) => {
            if (!hasServiceRole()) {
              return {
                ok: false,
                error: "Jobs service is not configured.",
              };
            }
            try {
              const { creative, job } = await startSearchCreative({
                workspaceId: active.workspace.id,
                productId,
                campaignIds: input.campaignIds,
                campaignId: input.campaignId ?? null,
                title: input.title,
                brief: input.brief,
                createdBy: user.id,
                trigger: "agent",
                plan,
              });
              return {
                ok: true,
                creativeId: creative.id,
                jobId: job.id,
                href: `/creatives/${creative.id}`,
                message: `Started search creative "${creative.title}". Review it in chat or on /creatives/${creative.id}.`,
              };
            } catch (err) {
              if (err instanceof PlanEntitlementError) {
                return { ok: false, error: err.message, code: err.code };
              }
              logServerError("chat.create_search_creative", err, {
                workspaceId: active.workspace.id,
                productId,
                plan,
              });
              return {
                ok: false,
                error: unknownErrorMessage(
                  err,
                  "Failed to start search creative.",
                ),
              };
            }
          },
        }),
        create_audio_creative: tool({
          description:
            "Start an audio ad creative pipeline (spoken script → voice spot) for the current product. Returns a creativeId; the user reviews each stage with Accept / Reject / Revise. Omit campaignIds unless attaching to existing campaign ids from a prior tool result — never invent campaign ids.",
          inputSchema: z.object({
            title: z.string().trim().min(1).max(120),
            brief: z.string().trim().min(1).max(4000),
            campaignIds: z.array(z.string()).optional(),
            campaignId: z.string().optional(),
          }),
          execute: async (input) => {
            if (!hasServiceRole()) {
              return {
                ok: false,
                error: "Jobs service is not configured.",
              };
            }
            try {
              const { creative, job } = await startAudioCreative({
                workspaceId: active.workspace.id,
                productId,
                campaignIds: input.campaignIds,
                campaignId: input.campaignId ?? null,
                title: input.title,
                brief: input.brief,
                createdBy: user.id,
                trigger: "agent",
                plan,
              });
              return {
                ok: true,
                creativeId: creative.id,
                jobId: job.id,
                href: `/creatives/${creative.id}`,
                message: `Started audio creative "${creative.title}". Review it in chat or on /creatives/${creative.id}.`,
              };
            } catch (err) {
              if (err instanceof PlanEntitlementError) {
                return { ok: false, error: err.message, code: err.code };
              }
              logServerError("chat.create_audio_creative", err, {
                workspaceId: active.workspace.id,
                productId,
                plan,
              });
              return {
                ok: false,
                error: unknownErrorMessage(
                  err,
                  "Failed to start audio creative.",
                ),
              };
            }
          },
        }),
        resubmit_creative: tool({
          description:
            "Re-run generation for an existing creative's current stage (video, display, search, or audio) after the user requested revisions. Pass creativeId and optional feedback or an updated brief.",
          inputSchema: z.object({
            creativeId: z.string().uuid(),
            feedback: z.string().trim().max(2000).optional(),
            brief: z.string().trim().max(4000).optional(),
          }),
          execute: async (input) => {
            if (!hasServiceRole()) {
              return {
                ok: false,
                error: "Jobs service is not configured.",
              };
            }
            try {
              const { creative, job } = await resubmitCreativeStage({
                workspaceId: active.workspace.id,
                creativeId: input.creativeId,
                createdBy: user.id,
                trigger: "agent",
                brief: input.brief,
                feedback: input.feedback,
              });
              return {
                ok: true,
                creativeId: creative.id,
                jobId: job.id,
                stage: creative.stage,
                href: `/creatives/${creative.id}`,
                message: `Resubmitted ${creative.stage} generation for "${creative.title}".`,
              };
            } catch (err) {
              logServerError("chat.resubmit_creative", err, {
                workspaceId: active.workspace.id,
                creativeId: input.creativeId,
              });
              return {
                ok: false,
                error: unknownErrorMessage(
                  err,
                  "Failed to resubmit creative.",
                ),
              };
            }
          },
        }),
        list_goals: tool({
          description:
            "List goals for the current workspace (product and workspace scope).",
          inputSchema: z.object({
            status: goalStatusSchema.optional(),
          }),
          execute: async (input) => {
            try {
              assertHasInsights(plan);
            } catch (err) {
              if (err instanceof PlanEntitlementError) {
                return { ok: false, error: err.message, code: err.code };
              }
              throw err;
            }
            const goals = await getGoalRepository();
            const list = await goals.listByWorkspace(active.workspace.id, {
              status: input.status,
            });
            return { ok: true, goals: list };
          },
        }),
        create_goal: tool({
          description:
            "Create a measurable goal. Prefer product scope with the current productId when the goal is product-specific.",
          inputSchema: z.object({
            scope: goalScopeSchema.default("product"),
            productId: z.string().optional(),
            title: z.string().trim().min(1).max(200),
            metric: goalMetricSchema.optional(),
            targetValue: z.number().finite().nullable().optional(),
            targetUnit: z.string().trim().max(20).nullable().optional(),
            horizon: goalHorizonSchema.optional(),
            notes: z.string().trim().max(2000).optional(),
          }),
          execute: async (input) => {
            try {
              assertHasInsights(plan);
            } catch (err) {
              if (err instanceof PlanEntitlementError) {
                return { ok: false, error: err.message, code: err.code };
              }
              throw err;
            }
            const scope = input.scope ?? "product";
            const resolvedProductId =
              scope === "product" ? (input.productId ?? productId) : null;
            if (scope === "product" && !resolvedProductId) {
              return { ok: false, error: "productId is required for product goals." };
            }
            const goals = await getGoalRepository();
            const goal = await goals.create({
              workspaceId: active.workspace.id,
              scope,
              productId: resolvedProductId,
              title: input.title,
              metric: input.metric,
              targetValue: input.targetValue,
              targetUnit: input.targetUnit,
              horizon: input.horizon,
              notes: input.notes,
              createdBy: user.id,
            });
            return {
              ok: true,
              goalId: goal.id,
              message: `Created goal "${goal.title}".`,
            };
          },
        }),
        update_goal: tool({
          description: "Update an existing goal (status, target, title, etc.).",
          inputSchema: z.object({
            goalId: z.string().uuid(),
            title: z.string().trim().min(1).max(200).optional(),
            metric: goalMetricSchema.optional(),
            targetValue: z.number().finite().nullable().optional(),
            targetUnit: z.string().trim().max(20).nullable().optional(),
            horizon: goalHorizonSchema.optional(),
            status: goalStatusSchema.optional(),
            notes: z.string().trim().max(2000).optional(),
          }),
          execute: async (input) => {
            try {
              assertHasInsights(plan);
            } catch (err) {
              if (err instanceof PlanEntitlementError) {
                return { ok: false, error: err.message, code: err.code };
              }
              throw err;
            }
            const goals = await getGoalRepository();
            const existing = await goals.getById(input.goalId);
            if (!existing || existing.workspaceId !== active.workspace.id) {
              return { ok: false, error: "Goal not found." };
            }
            const { goalId: _id, ...patch } = input;
            const goal = await goals.update(input.goalId, patch);
            return { ok: true, goalId: goal.id, goal };
          },
        }),
        propose_insight: tool({
          description:
            "Propose an insight for human review (Accept / Reject / Revise). For concrete copy/positioning/listing/campaign concepts, pass title, summary, deliverableType, and payload (apply_deliverable) — available on all plans. Omit those fields to enqueue async generation (Pro required).",
          inputSchema: z.object({
            productId: z.string().optional(),
            goalId: z.string().uuid().optional(),
            title: z.string().optional(),
            summary: z.string().optional(),
            rationale: z.string().optional(),
            deliverableType: deliverableTypeSchema.optional(),
            payload: z.record(z.string(), z.unknown()).optional(),
            campaignIds: z.array(z.string()).optional(),
            campaignId: z.string().optional(),
          }),
          execute: async (input) => {
            if (!hasServiceRole()) {
              return { ok: false, error: "Jobs service is not configured." };
            }
            const targetProductId = input.productId ?? productId;
            try {
              if (
                input.deliverableType &&
                input.title &&
                input.summary &&
                input.payload
              ) {
                const insight = await createDeliverableInsight({
                  workspaceId: active.workspace.id,
                  productId: targetProductId,
                  campaignIds: input.campaignIds,
                  campaignId: input.campaignId,
                  type: input.deliverableType,
                  title: input.title,
                  summary: input.summary,
                  rationale: input.rationale,
                  payload: input.payload,
                  userId: user.id,
                });
                return {
                  ok: true,
                  insightId: insight.id,
                  href: `/products/${targetProductId}`,
                  message: `Created insight "${insight.title}" for review in Decide.`,
                };
              }
              assertHasInsights(plan);
              const { insight, job } = await startInsightGeneration({
                workspaceId: active.workspace.id,
                productId: targetProductId,
                goalId: input.goalId ?? null,
                createdBy: user.id,
                insightTrigger: "agent",
                jobTrigger: "agent",
              });
              return {
                ok: true,
                insightId: insight.id,
                jobId: job.id,
                href: "/insights",
                message: `Started insight generation. Review it on /insights.`,
              };
            } catch (err) {
              if (err instanceof PlanEntitlementError) {
                return { ok: false, error: err.message, code: err.code };
              }
              return {
                ok: false,
                error:
                  err instanceof Error
                    ? err.message
                    : "Failed to propose insight.",
              };
            }
          },
        }),
        resubmit_insight: tool({
          description:
            "Re-generate an insight after the user requested revisions via Revise.",
          inputSchema: z.object({
            insightId: z.string().uuid(),
            feedback: z.string().trim().max(2000).optional(),
          }),
          execute: async (input) => {
            if (!hasServiceRole()) {
              return { ok: false, error: "Jobs service is not configured." };
            }
            try {
              assertHasInsights(plan);
              const { insight, job } = await resubmitInsight({
                workspaceId: active.workspace.id,
                insightId: input.insightId,
                createdBy: user.id,
                feedback: input.feedback,
              });
              return {
                ok: true,
                insightId: insight.id,
                jobId: job.id,
                href: "/insights",
                message: `Resubmitted insight "${insight.title || insight.id}".`,
              };
            } catch (err) {
              if (err instanceof PlanEntitlementError) {
                return { ok: false, error: err.message, code: err.code };
              }
              return {
                ok: false,
                error:
                  err instanceof Error
                    ? err.message
                    : "Failed to resubmit insight.",
              };
            }
          },
        }),
        query_performance: makeQueryPerformanceTool(
          active.workspace.id,
          product.id,
        ),
        create_visualization: makeCreateVisualizationTool(
          active.workspace.id,
          product.id,
        ),
      },
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    });
  }

  // Workspace mode
  const activeWorkspace = await getActiveWorkspace();
  if (!activeWorkspace) {
    return Response.json({ error: "No workspace available" }, { status: 400 });
  }
  const catalog = await productsRepo.listProducts(activeWorkspace.workspace.id);
  const ownedIds = new Set(catalog.map((p) => p.id));

  if (!hasAiGateway()) {
    return offlineWorkspaceStreamResponse(catalog, messages);
  }

  const gate = await assertWalletAllowsAi(activeWorkspace.workspace.id);
  if (!gate.ok) return gate.response;

  const plan = normalizeWorkspacePlan(activeWorkspace.workspace.plan);
  const result = streamText({
    model: gateway(chatModel),
    system: buildWorkspaceSystemPrompt(catalog, plan),
    messages: await convertToModelMessages(messages),
    providerOptions: {
      gateway: {
        user: user.id,
        tags: ["feature:chat", "scope:workspace", `model:${chatModel}`],
      },
    },
    onFinish: async ({ usage }) => {
      await chargeAiUsage({
        workspaceId: activeWorkspace.workspace.id,
        userId: user.id,
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        model: chatModel,
        tokenPricing: gatewayModel?.pricing,
      });
    },
    tools: {
      run_job: tool({
        description:
          "Start a background job for a product in the workspace. Use type create_campaign with productId from the catalog. Returns immediately with a jobId; progress appears on /jobs.",
        inputSchema: z.object({
          type: z.literal("create_campaign"),
          productId: z.string(),
          name: z.string().trim().min(1).max(120),
          objective: z.string().trim().max(500).optional(),
          channels: z.array(z.string().trim().min(1)).max(20).optional(),
        }),
        execute: async (input) => {
          if (!ownedIds.has(input.productId)) {
            return {
              ok: false,
              message: "productId is not in this workspace catalog.",
            };
          }
          if (!hasServiceRole()) {
            return {
              ok: false,
              error: "Jobs service is not configured.",
            };
          }
          try {
            const job = await enqueueCreateCampaignJob({
              workspaceId: activeWorkspace.workspace.id,
              createdBy: user.id,
              trigger: "agent",
              input: {
                productId: input.productId,
                name: input.name,
                objective: input.objective,
                channels: input.channels,
              },
            });
            return {
              ok: true,
              jobId: job.id,
              message: `Campaign job started. Track it on /jobs (id ${job.id}).`,
            };
          } catch (err) {
            return {
              ok: false,
              error:
                err instanceof Error ? err.message : "Failed to start job.",
            };
          }
        },
      }),
      create_video_creative: tool({
        description:
          "Start a video ad creative pipeline (screenplay → world → storyboard → video) for a product in the catalog. Returns a creativeId for Accept / Reject / Revise review. Omit campaignIds unless attaching to existing campaign ids from a prior tool result — never invent campaign ids.",
        inputSchema: z.object({
          productId: z.string(),
          title: z.string().trim().min(1).max(120),
          brief: z.string().trim().min(1).max(4000),
          campaignIds: z.array(z.string()).optional(),
          campaignId: z.string().optional(),
        }),
        execute: async (input) => {
          if (!ownedIds.has(input.productId)) {
            return {
              ok: false,
              message: "productId is not in this workspace catalog.",
            };
          }
          if (!hasServiceRole()) {
            return {
              ok: false,
              error: "Jobs service is not configured.",
            };
          }
          try {
            const { creative, job } = await startVideoCreative({
              workspaceId: activeWorkspace.workspace.id,
              productId: input.productId,
              campaignIds: input.campaignIds,
              campaignId: input.campaignId ?? null,
              title: input.title,
              brief: input.brief,
              createdBy: user.id,
              trigger: "agent",
              plan,
            });
            return {
              ok: true,
              creativeId: creative.id,
              jobId: job.id,
              href: `/creatives/${creative.id}`,
              message: `Started video creative "${creative.title}". Review it in chat or on /creatives/${creative.id}.`,
            };
          } catch (err) {
            if (err instanceof PlanEntitlementError) {
              return { ok: false, error: err.message, code: err.code };
            }
            logServerError("chat.create_video_creative", err, {
              workspaceId: activeWorkspace.workspace.id,
              productId: input.productId,
              plan,
            });
            return {
              ok: false,
              error: unknownErrorMessage(
                err,
                "Failed to start video creative.",
              ),
            };
          }
        },
      }),
      create_display_creative: tool({
        description:
          "Start a display ad creative pipeline (concept copy → marketing/square images) for a product in the catalog. Returns a creativeId for Accept / Reject / Revise review. Omit campaignIds unless attaching to existing campaign ids from a prior tool result — never invent campaign ids.",
        inputSchema: z.object({
          productId: z.string(),
          title: z.string().trim().min(1).max(120),
          brief: z.string().trim().min(1).max(4000),
          campaignIds: z.array(z.string()).optional(),
          campaignId: z.string().optional(),
        }),
        execute: async (input) => {
          if (!ownedIds.has(input.productId)) {
            return {
              ok: false,
              message: "productId is not in this workspace catalog.",
            };
          }
          if (!hasServiceRole()) {
            return {
              ok: false,
              error: "Jobs service is not configured.",
            };
          }
          try {
            const { creative, job } = await startDisplayCreative({
              workspaceId: activeWorkspace.workspace.id,
              productId: input.productId,
              campaignIds: input.campaignIds,
              campaignId: input.campaignId ?? null,
              title: input.title,
              brief: input.brief,
              createdBy: user.id,
              trigger: "agent",
              plan,
            });
            return {
              ok: true,
              creativeId: creative.id,
              jobId: job.id,
              href: `/creatives/${creative.id}`,
              message: `Started display creative "${creative.title}". Review it in chat or on /creatives/${creative.id}.`,
            };
          } catch (err) {
            if (err instanceof PlanEntitlementError) {
              return { ok: false, error: err.message, code: err.code };
            }
            logServerError("chat.create_display_creative", err, {
              workspaceId: activeWorkspace.workspace.id,
              productId: input.productId,
              plan,
            });
            return {
              ok: false,
              error: unknownErrorMessage(
                err,
                "Failed to start display creative.",
              ),
            };
          }
        },
      }),
      create_search_creative: tool({
        description:
          "Start a search ad creative pipeline (RSA copy → keyword themes) for a product in the catalog. Returns a creativeId for Accept / Reject / Revise review. Omit campaignIds unless attaching to existing campaign ids from a prior tool result — never invent campaign ids.",
        inputSchema: z.object({
          productId: z.string(),
          title: z.string().trim().min(1).max(120),
          brief: z.string().trim().min(1).max(4000),
          campaignIds: z.array(z.string()).optional(),
          campaignId: z.string().optional(),
        }),
        execute: async (input) => {
          if (!ownedIds.has(input.productId)) {
            return {
              ok: false,
              message: "productId is not in this workspace catalog.",
            };
          }
          if (!hasServiceRole()) {
            return {
              ok: false,
              error: "Jobs service is not configured.",
            };
          }
          try {
            const { creative, job } = await startSearchCreative({
              workspaceId: activeWorkspace.workspace.id,
              productId: input.productId,
              campaignIds: input.campaignIds,
              campaignId: input.campaignId ?? null,
              title: input.title,
              brief: input.brief,
              createdBy: user.id,
              trigger: "agent",
              plan,
            });
            return {
              ok: true,
              creativeId: creative.id,
              jobId: job.id,
              href: `/creatives/${creative.id}`,
              message: `Started search creative "${creative.title}". Review it in chat or on /creatives/${creative.id}.`,
            };
          } catch (err) {
            if (err instanceof PlanEntitlementError) {
              return { ok: false, error: err.message, code: err.code };
            }
            logServerError("chat.create_search_creative", err, {
              workspaceId: activeWorkspace.workspace.id,
              productId: input.productId,
              plan,
            });
            return {
              ok: false,
              error: unknownErrorMessage(
                err,
                "Failed to start search creative.",
              ),
            };
          }
        },
      }),
      create_audio_creative: tool({
        description:
          "Start an audio ad creative pipeline (spoken script → voice spot) for a product in the catalog. Returns a creativeId for Accept / Reject / Revise review. Omit campaignIds unless attaching to existing campaign ids from a prior tool result — never invent campaign ids.",
        inputSchema: z.object({
          productId: z.string(),
          title: z.string().trim().min(1).max(120),
          brief: z.string().trim().min(1).max(4000),
          campaignIds: z.array(z.string()).optional(),
          campaignId: z.string().optional(),
        }),
        execute: async (input) => {
          if (!ownedIds.has(input.productId)) {
            return {
              ok: false,
              message: "productId is not in this workspace catalog.",
            };
          }
          if (!hasServiceRole()) {
            return {
              ok: false,
              error: "Jobs service is not configured.",
            };
          }
          try {
            const { creative, job } = await startAudioCreative({
              workspaceId: activeWorkspace.workspace.id,
              productId: input.productId,
              campaignIds: input.campaignIds,
              campaignId: input.campaignId ?? null,
              title: input.title,
              brief: input.brief,
              createdBy: user.id,
              trigger: "agent",
              plan,
            });
            return {
              ok: true,
              creativeId: creative.id,
              jobId: job.id,
              href: `/creatives/${creative.id}`,
              message: `Started audio creative "${creative.title}". Review it in chat or on /creatives/${creative.id}.`,
            };
          } catch (err) {
            if (err instanceof PlanEntitlementError) {
              return { ok: false, error: err.message, code: err.code };
            }
            logServerError("chat.create_audio_creative", err, {
              workspaceId: activeWorkspace.workspace.id,
              productId: input.productId,
              plan,
            });
            return {
              ok: false,
              error: unknownErrorMessage(
                err,
                "Failed to start audio creative.",
              ),
            };
          }
        },
      }),
      resubmit_creative: tool({
        description:
          "Re-run generation for an existing creative's current stage (video, display, search, or audio) after revision feedback. Pass creativeId and optional feedback or brief.",
        inputSchema: z.object({
          creativeId: z.string().uuid(),
          feedback: z.string().trim().max(2000).optional(),
          brief: z.string().trim().max(4000).optional(),
        }),
        execute: async (input) => {
          if (!hasServiceRole()) {
            return {
              ok: false,
              error: "Jobs service is not configured.",
            };
          }
          try {
            const { creative, job } = await resubmitCreativeStage({
              workspaceId: activeWorkspace.workspace.id,
              creativeId: input.creativeId,
              createdBy: user.id,
              trigger: "agent",
              brief: input.brief,
              feedback: input.feedback,
            });
            return {
              ok: true,
              creativeId: creative.id,
              jobId: job.id,
              stage: creative.stage,
              href: `/creatives/${creative.id}`,
              message: `Resubmitted ${creative.stage} generation for "${creative.title}".`,
            };
          } catch (err) {
            logServerError("chat.resubmit_creative", err, {
              workspaceId: activeWorkspace.workspace.id,
              creativeId: input.creativeId,
            });
            return {
              ok: false,
              error: unknownErrorMessage(
                err,
                "Failed to resubmit creative.",
              ),
            };
          }
        },
      }),
      list_goals: tool({
        description:
          "List goals for the current workspace (product and workspace scope).",
        inputSchema: z.object({
          status: goalStatusSchema.optional(),
        }),
        execute: async (input) => {
          try {
            assertHasInsights(plan);
          } catch (err) {
            if (err instanceof PlanEntitlementError) {
              return { ok: false, error: err.message, code: err.code };
            }
            throw err;
          }
          const goals = await getGoalRepository();
          const list = await goals.listByWorkspace(
            activeWorkspace.workspace.id,
            { status: input.status },
          );
          return { ok: true, goals: list };
        },
      }),
      create_goal: tool({
        description:
          "Create a measurable goal. For product scope, pass productId from the catalog.",
        inputSchema: z.object({
          scope: goalScopeSchema,
          productId: z.string().optional(),
          title: z.string().trim().min(1).max(200),
          metric: goalMetricSchema.optional(),
          targetValue: z.number().finite().nullable().optional(),
          targetUnit: z.string().trim().max(20).nullable().optional(),
          horizon: goalHorizonSchema.optional(),
          notes: z.string().trim().max(2000).optional(),
        }),
        execute: async (input) => {
          try {
            assertHasInsights(plan);
          } catch (err) {
            if (err instanceof PlanEntitlementError) {
              return { ok: false, error: err.message, code: err.code };
            }
            throw err;
          }
          if (input.scope === "product") {
            if (!input.productId || !ownedIds.has(input.productId)) {
              return {
                ok: false,
                error: "productId must be in this workspace catalog.",
              };
            }
          }
          const goals = await getGoalRepository();
          const goal = await goals.create({
            workspaceId: activeWorkspace.workspace.id,
            scope: input.scope,
            productId: input.scope === "product" ? input.productId : null,
            title: input.title,
            metric: input.metric,
            targetValue: input.targetValue,
            targetUnit: input.targetUnit,
            horizon: input.horizon,
            notes: input.notes,
            createdBy: user.id,
          });
          return {
            ok: true,
            goalId: goal.id,
            message: `Created goal "${goal.title}".`,
          };
        },
      }),
      update_goal: tool({
        description: "Update an existing goal (status, target, title, etc.).",
        inputSchema: z.object({
          goalId: z.string().uuid(),
          title: z.string().trim().min(1).max(200).optional(),
          metric: goalMetricSchema.optional(),
          targetValue: z.number().finite().nullable().optional(),
          targetUnit: z.string().trim().max(20).nullable().optional(),
          horizon: goalHorizonSchema.optional(),
          status: goalStatusSchema.optional(),
          notes: z.string().trim().max(2000).optional(),
        }),
        execute: async (input) => {
          try {
            assertHasInsights(plan);
          } catch (err) {
            if (err instanceof PlanEntitlementError) {
              return { ok: false, error: err.message, code: err.code };
            }
            throw err;
          }
          const goals = await getGoalRepository();
          const existing = await goals.getById(input.goalId);
          if (
            !existing ||
            existing.workspaceId !== activeWorkspace.workspace.id
          ) {
            return { ok: false, error: "Goal not found." };
          }
          const { goalId: _id, ...patch } = input;
          const goal = await goals.update(input.goalId, patch);
          return { ok: true, goalId: goal.id, goal };
        },
      }),
      propose_insight: tool({
        description:
          "Propose an insight for human review. For concrete deliverables, pass productId, title, summary, deliverableType, and payload. Async generation without those fields requires Pro.",
        inputSchema: z.object({
          productId: z.string().optional(),
          goalId: z.string().uuid().optional(),
          title: z.string().optional(),
          summary: z.string().optional(),
          rationale: z.string().optional(),
          deliverableType: deliverableTypeSchema.optional(),
          payload: z.record(z.string(), z.unknown()).optional(),
          campaignIds: z.array(z.string()).optional(),
          campaignId: z.string().optional(),
        }),
        execute: async (input) => {
          const targetProductId = input.productId;
          if (targetProductId && !ownedIds.has(targetProductId)) {
            return {
              ok: false,
              error: "productId is not in this workspace catalog.",
            };
          }
          if (!hasServiceRole()) {
            return { ok: false, error: "Jobs service is not configured." };
          }
          try {
            if (
              input.deliverableType &&
              input.title &&
              input.summary &&
              input.payload &&
              targetProductId
            ) {
              const insight = await createDeliverableInsight({
                workspaceId: activeWorkspace.workspace.id,
                productId: targetProductId,
                campaignIds: input.campaignIds,
                campaignId: input.campaignId,
                type: input.deliverableType,
                title: input.title,
                summary: input.summary,
                rationale: input.rationale,
                payload: input.payload,
                userId: user.id,
              });
              return {
                ok: true,
                insightId: insight.id,
                href: `/products/${targetProductId}`,
                message: `Created insight "${insight.title}" for review in Decide.`,
              };
            }
            assertHasInsights(plan);
            const { insight, job } = await startInsightGeneration({
              workspaceId: activeWorkspace.workspace.id,
              productId: targetProductId ?? null,
              goalId: input.goalId ?? null,
              createdBy: user.id,
              insightTrigger: "agent",
              jobTrigger: "agent",
            });
            return {
              ok: true,
              insightId: insight.id,
              jobId: job.id,
              href: "/insights",
              message: `Started insight generation. Review it on /insights.`,
            };
          } catch (err) {
            if (err instanceof PlanEntitlementError) {
              return { ok: false, error: err.message, code: err.code };
            }
            return {
              ok: false,
              error:
                err instanceof Error
                  ? err.message
                  : "Failed to propose insight.",
            };
          }
        },
      }),
      resubmit_insight: tool({
        description:
          "Re-generate an insight after the user requested revisions via Revise.",
        inputSchema: z.object({
          insightId: z.string().uuid(),
          feedback: z.string().trim().max(2000).optional(),
        }),
        execute: async (input) => {
          if (!hasServiceRole()) {
            return { ok: false, error: "Jobs service is not configured." };
          }
          try {
            assertHasInsights(plan);
            const { insight, job } = await resubmitInsight({
              workspaceId: activeWorkspace.workspace.id,
              insightId: input.insightId,
              createdBy: user.id,
              feedback: input.feedback,
            });
            return {
              ok: true,
              insightId: insight.id,
              jobId: job.id,
              href: "/insights",
              message: `Resubmitted insight "${insight.title || insight.id}".`,
            };
          } catch (err) {
            if (err instanceof PlanEntitlementError) {
              return { ok: false, error: err.message, code: err.code };
            }
            return {
              ok: false,
              error:
                err instanceof Error
                  ? err.message
                  : "Failed to resubmit insight.",
            };
          }
        },
      }),
      query_performance: makeQueryPerformanceTool(activeWorkspace.workspace.id),
      create_visualization: makeCreateVisualizationTool(
        activeWorkspace.workspace.id,
      ),
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
