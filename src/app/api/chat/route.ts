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
  Artifact,
  Product,
  ProductIntelligence,
  WorkspacePlan,
} from "@/domain";
import { visualizationKindSchema } from "@/domain";
import { resolveChatModel } from "@/lib/ai/models";
import { hasAiGateway } from "@/lib/mode";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import {
  PlanEntitlementError,
  assertCanCreateCreative,
} from "@/lib/billing/gates";
import {
  enqueueCreateCampaignJob,
  resubmitCreativeStage,
  startVideoCreative,
} from "@/lib/jobs/enqueue";
import { hasServiceRole } from "@/lib/supabase/service";
import { assertWalletAllowsAi, chargeAiUsage } from "@/lib/wallet/gate";
import {
  buildCreateVisualizationResult,
  inferVisualizationFromPrompt,
} from "@/features/visualizer/create-visualization";
import { getArtifactRepository, getProductRepository } from "@/repositories";

const createVisualizationToolSchema = z.object({
  title: z.string().trim().min(1).max(120),
  kind: visualizationKindSchema,
  prompt: z.string().trim().max(500).optional(),
  periodA: z.string().trim().max(40).optional(),
  periodB: z.string().trim().max(40).optional(),
});

const createVisualizationTool = tool({
  description:
    "Create a chart visualization and open it as a new visualizer tab. Use for performance questions, funnel/flow questions, campaign comparisons (e.g. Q1 vs Q2), or when the user asks to chart or visualize data. Prefer comparison for period-over-period, sankey for funnels/flows, timeseries for trends, bar for channel or category breakdowns.",
  inputSchema: createVisualizationToolSchema,
  execute: async (input) => {
    const result = buildCreateVisualizationResult({
      title: input.title,
      kind: input.kind,
      prompt: input.prompt,
      periodA: input.periodA,
      periodB: input.periodB,
    });
    return result;
  },
});

export const runtime = "nodejs";

function buildProductSystemPrompt(
  product: Product,
  intelligence: ProductIntelligence | null,
  plan: WorkspacePlan,
): string {
  return `You are Product Agent, an AI marketing collaborator for commerce products.
You help develop positioning, ad copy, campaign concepts, listing updates, and video ad creatives.
Workspace plan: ${plan}. Video creatives and saved campaigns require Hobby or Pro — if a tool returns a plan upgrade error, tell the user clearly and stop asking for more creative details.
Always prefer calling propose_artifact when you have a concrete text proposal ready for review.
When the user wants to create a campaign (not just a concept proposal), call run_job with type create_campaign.
Keep propose_artifact for reviewable copy, positioning, and campaign concepts; use run_job to actually create a draft campaign.
When the user wants a video ad, call create_video_creative immediately with a short title and brief. If they ask you to invent the concept (e.g. "come up with something"), invent the title and brief yourself and call the tool — do not ask follow-up questions first.
When the user is revising an existing video creative (they mention a creative id or are iterating on feedback), call resubmit_creative with that creativeId — do not create a new creative.
When proposing ad_copy creatives for a campaign, include that campaign's id as campaignId.
When the user asks about performance, funnels, comparisons (e.g. Q1 vs Q2), trends, or wants a chart/visualization, call create_visualization with an appropriate kind (sankey, timeseries, comparison, or bar) and a clear title.
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
}`;
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
Help prioritize work, compare products, and propose marketing artifacts for specific products.
Workspace plan: ${plan}. Video creatives and saved campaigns require Hobby or Pro — if a tool returns a plan upgrade error, tell the user clearly and stop asking for more creative details.
When proposing an artifact, always call propose_artifact with the target productId from the catalog.
When the user wants to create a campaign for a product, call run_job with type create_campaign and that productId.
Keep propose_artifact for reviewable copy and concepts; use run_job to create a draft campaign.
When the user wants a video ad, call create_video_creative immediately with productId from the catalog (match @mentions to catalog ids), plus a short title and brief. If they ask you to invent the concept, invent title and brief yourself and call the tool — do not ask follow-up questions first.
When the user is revising an existing video creative, call resubmit_creative with that creativeId — do not create a new creative.
When the user asks about performance, funnels, comparisons (e.g. Q1 vs Q2), trends, or wants a chart/visualization, call create_visualization with an appropriate kind (sankey, timeseries, comparison, or bar) and a clear title.
Never invent inventory or prices that contradict the catalog.
The user may navigate between pages during a conversation. Treat this workspace context as the current page for this turn.

Workspace catalog:
${catalog}`;
}

async function createArtifactFromProposal(input: {
  productId: string;
  campaignId?: string | null;
  type: Artifact["type"];
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  userId: string;
  plan: WorkspacePlan;
}): Promise<Artifact> {
  const artifacts = await getArtifactRepository();

  if (input.type === "ad_copy") {
    if (input.campaignId) {
      const count = await artifacts.countCreativesByCampaign(input.campaignId);
      assertCanCreateCreative(input.plan, count);
    } else {
      // Product-level creatives still respect the plan cap (0 on Free).
      assertCanCreateCreative(input.plan, 0);
    }
  }

  const now = new Date().toISOString();
  const artifact: Artifact = {
    id: `art_${crypto.randomUUID().slice(0, 8)}`,
    productId: input.productId,
    campaignId: input.campaignId ?? null,
    type: input.type,
    status: "proposed",
    title: input.title,
    summary: input.summary,
    payload: input.payload,
    createdBy: input.userId,
    createdAt: now,
    updatedAt: now,
  };
  return artifacts.create(artifact);
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

  const result = buildCreateVisualizationResult({
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
  userId: string,
  plan: WorkspacePlan,
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
        `Reviewing ${product.title}. I'll draft positioning and Meta ad copy as structured artifacts for your approval.\n\n` +
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

      await createArtifactFromProposal({
        productId: product.id,
        type: "positioning",
        title: `${product.title} — refined positioning`,
        summary: "Positioning proposal ready for review.",
        payload: {
          positioning: `${product.title} is the premium everyday choice for customers who want durable design without disposable waste.`,
          audience: "Design-conscious shoppers aged 25–45 discovering elevated essentials",
          valueProps: [
            "Built for daily use",
            "Distinctive finishes",
            "Clear quality signal at shelf",
          ],
          objections: ["Premium price vs commodity alternatives"],
          tone: "Confident, restrained, product-led",
        },
        userId,
        plan,
      });

      try {
        await createArtifactFromProposal({
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
          plan,
        });
      } catch (err) {
        if (!(err instanceof PlanEntitlementError)) throw err;
      }

      write(
        `data: ${JSON.stringify({
          type: "text-delta",
          id: messageId,
          delta:
            "\n\nArtifacts are ready in the Artifacts tab for review. Approve to apply them.",
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

const artifactTypeSchema = z.enum([
  "positioning",
  "ad_copy",
  "campaign_concept",
  "listing_update",
]);

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    messages?: UIMessage[];
    productId?: string;
    model?: string;
  };

  const productId = body.productId;
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

    if (!hasAiGateway()) {
      return offlineProductStreamResponse(
        product,
        user.id,
        active.workspace.plan ?? "free",
        messages,
      );
    }

    const gate = await assertWalletAllowsAi(active.workspace.id);
    if (!gate.ok) return gate.response;

    const plan = active.workspace.plan ?? "free";
    const result = streamText({
      model: gateway(chatModel),
      system: buildProductSystemPrompt(product, intelligence, plan),
      messages: await convertToModelMessages(messages),
      providerOptions: {
        gateway: {
          user: user.id,
          tags: ["feature:chat", "scope:product", `model:${chatModel}`],
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
        propose_artifact: tool({
          description:
            "Propose a structured marketing artifact for human review before it is applied. For ad_copy creatives tied to a campaign, pass campaignId.",
          inputSchema: z.object({
            type: artifactTypeSchema,
            title: z.string(),
            summary: z.string(),
            payload: z.record(z.string(), z.unknown()),
            campaignId: z.string().optional(),
          }),
          execute: async (input) => {
            try {
              const artifact = await createArtifactFromProposal({
                productId,
                campaignId: input.campaignId,
                type: input.type,
                title: input.title,
                summary: input.summary,
                payload: input.payload,
                userId: user.id,
                plan,
              });
              return {
                ok: true,
                artifactId: artifact.id,
                message: `Created proposal "${artifact.title}" for review.`,
              };
            } catch (err) {
              if (err instanceof PlanEntitlementError) {
                return { ok: false, error: err.message, code: err.code };
              }
              throw err;
            }
          },
        }),
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
            "Start a video ad creative pipeline (screenplay → storyboard → video) for the current product. Returns a creativeId; the user reviews each stage with Accept / Reject / Revise.",
          inputSchema: z.object({
            title: z.string().trim().min(1).max(120),
            brief: z.string().trim().min(1).max(4000),
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
              return {
                ok: false,
                error:
                  err instanceof Error
                    ? err.message
                    : "Failed to start video creative.",
              };
            }
          },
        }),
        resubmit_creative: tool({
          description:
            "Re-run generation for an existing video creative's current stage after the user requested revisions. Pass creativeId and optional feedback or an updated brief.",
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
              return {
                ok: false,
                error:
                  err instanceof Error
                    ? err.message
                    : "Failed to resubmit creative.",
              };
            }
          },
        }),
        create_visualization: createVisualizationTool,
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

  const plan = activeWorkspace.workspace.plan ?? "free";
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
      propose_artifact: tool({
        description:
          "Propose a structured marketing artifact for a specific product in the workspace. productId must be one of the catalog ids. For ad_copy creatives tied to a campaign, pass campaignId.",
        inputSchema: z.object({
          productId: z.string(),
          type: artifactTypeSchema,
          title: z.string(),
          summary: z.string(),
          payload: z.record(z.string(), z.unknown()),
          campaignId: z.string().optional(),
        }),
        execute: async (input) => {
          if (!ownedIds.has(input.productId)) {
            return {
              ok: false,
              message: "productId is not in this workspace catalog.",
            };
          }
          try {
            const artifact = await createArtifactFromProposal({
              productId: input.productId,
              campaignId: input.campaignId,
              type: input.type,
              title: input.title,
              summary: input.summary,
              payload: input.payload,
              userId: user.id,
              plan,
            });
            return {
              ok: true,
              artifactId: artifact.id,
              message: `Created proposal "${artifact.title}" for review.`,
            };
          } catch (err) {
            if (err instanceof PlanEntitlementError) {
              return { ok: false, error: err.message, code: err.code };
            }
            throw err;
          }
        },
      }),
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
          "Start a video ad creative pipeline (screenplay → storyboard → video) for a product in the catalog. Returns a creativeId for Accept / Reject / Revise review.",
        inputSchema: z.object({
          productId: z.string(),
          title: z.string().trim().min(1).max(120),
          brief: z.string().trim().min(1).max(4000),
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
            return {
              ok: false,
              error:
                err instanceof Error
                  ? err.message
                  : "Failed to start video creative.",
            };
          }
        },
      }),
      resubmit_creative: tool({
        description:
          "Re-run generation for an existing video creative's current stage after revision feedback. Pass creativeId and optional feedback or brief.",
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
            return {
              ok: false,
              error:
                err instanceof Error
                  ? err.message
                  : "Failed to resubmit creative.",
            };
          }
        },
      }),
      create_visualization: createVisualizationTool,
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
