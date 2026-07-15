import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { getWalletWriteRepository } from "@/repositories";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  const url = new URL(req.url);
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") ?? 50)),
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));

  try {
    const repo = getWalletWriteRepository();
    await repo.ensureWallet(active.workspace.id);
    const transactions = await repo.listTransactions(active.workspace.id, {
      limit,
      offset,
    });
    return NextResponse.json({ transactions });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list transactions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
