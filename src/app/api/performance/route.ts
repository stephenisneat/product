import { NextResponse } from "next/server";
import { z } from "zod";
import { adChannelProviderSchema } from "@/domain";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { daysAgoUtc, isoDateUtc } from "@/lib/performance/date-range";
import { getPerformanceRepository } from "@/repositories";

export const runtime = "nodejs";

const querySchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  productId: z.string().optional(),
  provider: adChannelProviderSchema.optional(),
  connectionId: z.string().optional(),
  groupBy: z.enum(["date", "provider", "campaign"]).optional(),
});

/** Workspace-scoped campaign performance (normalized daily metrics). */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace available" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    startDate: searchParams.get("startDate") ?? undefined,
    endDate: searchParams.get("endDate") ?? undefined,
    productId: searchParams.get("productId") ?? undefined,
    provider: searchParams.get("provider") ?? undefined,
    connectionId: searchParams.get("connectionId") ?? undefined,
    groupBy: searchParams.get("groupBy") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const endDate = parsed.data.endDate ?? isoDateUtc();
  const startDate = parsed.data.startDate ?? daysAgoUtc(30);

  const performance = await getPerformanceRepository();
  const result = await performance.queryPerformance({
    workspaceId: active.workspace.id,
    productId: parsed.data.productId,
    provider: parsed.data.provider,
    connectionId: parsed.data.connectionId,
    startDate,
    endDate,
    groupBy: parsed.data.groupBy,
  });

  return NextResponse.json({
    startDate,
    endDate,
    ...result,
  });
}
