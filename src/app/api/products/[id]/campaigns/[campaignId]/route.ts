import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import {
  PlanEntitlementError,
  assertCanSpendAndLaunch,
} from "@/lib/billing/gates";
import { activateCampaignSpend } from "@/lib/channels/launch-campaign";
import { getProductRepository } from "@/repositories";

export const runtime = "nodejs";

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    objective: z.string().trim().max(500).optional(),
    channels: z.array(z.string().trim().min(1)).max(20).optional(),
    status: z.enum(["draft", "active", "paused"]).optional(),
    /** First-day ad spend to debit when activating (cents). Default $20. */
    launchBudgetCents: z.number().int().positive().max(10_000_000).optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.objective !== undefined ||
      data.channels !== undefined ||
      data.status !== undefined,
    { message: "At least one field is required" },
  );

type Params = { params: Promise<{ id: string; campaignId: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { id: productId, campaignId } = await params;
  const products = await getProductRepository();
  const product = await products.getProduct(productId);
  if (!product || product.workspaceId !== active.workspace.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const plan = active.workspace.plan ?? "free";
  if (parsed.data.status === "active") {
    try {
      assertCanSpendAndLaunch(plan);
    } catch (err) {
      if (err instanceof PlanEntitlementError) {
        return NextResponse.json(
          { error: err.message, code: err.code },
          { status: err.status },
        );
      }
      throw err;
    }
  }

  try {
    const existing = (await products.listCampaigns(productId)).find(
      (c) => c.id === campaignId,
    );
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const becomingActive =
      parsed.data.status === "active" && existing.status !== "active";

    const campaign = await products.updateCampaign(
      productId,
      campaignId,
      parsed.data,
    );

    if (becomingActive) {
      const amountCents = parsed.data.launchBudgetCents ?? 2000;
      try {
        await activateCampaignSpend({
          workspaceId: active.workspace.id,
          plan,
          productId,
          campaignId,
          userId: user.id,
          amountCents,
        });
      } catch (err) {
        if (err instanceof PlanEntitlementError) {
          return NextResponse.json(
            { error: err.message, code: err.code, campaign },
            { status: err.status },
          );
        }
        const message =
          err instanceof Error ? err.message : "Failed to activate ad spend";
        return NextResponse.json(
          { error: message, campaign },
          { status: 502 },
        );
      }
    }

    return NextResponse.json({ campaign });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
