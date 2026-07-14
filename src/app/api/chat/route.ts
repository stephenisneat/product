import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  tool,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { z } from "zod";
import type { Artifact, Product, ProductIntelligence } from "@/domain";
import { hasOpenAI } from "@/lib/mode";
import { getCurrentUser } from "@/lib/auth/session";
import { getArtifactRepository, getProductRepository } from "@/repositories";

export const runtime = "nodejs";

function buildSystemPrompt(
  product: Product,
  intelligence: ProductIntelligence | null,
): string {
  return `You are Product Agent, an AI marketing collaborator for commerce products.
You help develop positioning, ad copy, campaign concepts, and listing updates.
Always prefer calling propose_artifact when you have a concrete proposal ready for review.
Never invent inventory or prices that contradict the product context.

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

async function createArtifactFromProposal(input: {
  productId: string;
  type: Artifact["type"];
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  userId: string;
}): Promise<Artifact> {
  const artifacts = await getArtifactRepository();
  const now = new Date().toISOString();
  const artifact: Artifact = {
    id: `art_${crypto.randomUUID().slice(0, 8)}`,
    productId: input.productId,
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

function demoStreamResponse(product: Product, userId: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const write = (chunk: string) => controller.enqueue(encoder.encode(chunk));

      const text =
        `Reviewing ${product.title}. I'll draft positioning and Meta ad copy as structured artifacts for your approval.\n\n` +
        `Creating two proposals now…`;

      // Minimal UI message stream protocol for AI SDK client
      write(`data: ${JSON.stringify({ type: "start" })}\n\n`);
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
        summary: "Demo positioning proposal ready for review.",
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
      });

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
      });

      write(
        `data: ${JSON.stringify({
          type: "text-delta",
          id: messageId,
          delta:
            "\n\nTwo artifacts are ready in the Artifacts tab: positioning and Meta ad copy. Approve to apply them.",
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

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    messages?: UIMessage[];
    productId?: string;
  };

  const productId = body.productId;
  if (!productId) {
    return Response.json({ error: "productId is required" }, { status: 400 });
  }

  const products = await getProductRepository();
  const product = await products.getProduct(productId);
  if (!product) {
    return Response.json({ error: "Product not found" }, { status: 404 });
  }

  const intelligence = await products.getIntelligence(productId);
  const messages = body.messages ?? [];

  if (!hasOpenAI()) {
    return demoStreamResponse(product, user.id);
  }

  const result = streamText({
    model: openai("gpt-4.1-mini"),
    system: buildSystemPrompt(product, intelligence),
    messages: await convertToModelMessages(messages),
    tools: {
      propose_artifact: tool({
        description:
          "Propose a structured marketing artifact for human review before it is applied.",
        inputSchema: z.object({
          type: z.enum([
            "positioning",
            "ad_copy",
            "campaign_concept",
            "listing_update",
          ]),
          title: z.string(),
          summary: z.string(),
          payload: z.record(z.string(), z.unknown()),
        }),
        execute: async (input) => {
          const artifact = await createArtifactFromProposal({
            productId,
            type: input.type,
            title: input.title,
            summary: input.summary,
            payload: input.payload,
            userId: user.id,
          });
          return {
            ok: true,
            artifactId: artifact.id,
            message: `Created proposal "${artifact.title}" for review.`,
          };
        },
      }),
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
