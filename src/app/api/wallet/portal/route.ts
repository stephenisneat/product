import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  canManageMembers,
  getActiveWorkspace,
} from "@/lib/auth/workspace";
import { getAppUrl, getStripe, hasStripe } from "@/lib/stripe/client";
import { ensureStripeCustomer } from "@/lib/stripe/customers";
import { getWalletWriteRepository } from "@/repositories";

export const runtime = "nodejs";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasStripe()) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 },
    );
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }
  if (!canManageMembers(active.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const repo = getWalletWriteRepository();
  const { customerId } = await ensureStripeCustomer(active.workspace, repo);
  const appUrl = getAppUrl();

  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/?wallet=portal_return`,
  });

  return NextResponse.json({ url: session.url });
}
