import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  canManageWorkspace,
  getActiveWorkspace,
} from "@/lib/auth/workspace";
import { getAppUrl, getStripe, hasStripe } from "@/lib/stripe/client";
import { ensureStripeCustomer } from "@/lib/stripe/customers";
import { getWalletWriteRepository } from "@/repositories";

export const runtime = "nodejs";

/** Stripe Customer Portal for managing subscription / payment methods. */
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
  if (!canManageWorkspace(active.role)) {
    return NextResponse.json(
      { error: "Only the workspace owner can manage billing." },
      { status: 403 },
    );
  }

  const repo = getWalletWriteRepository();
  const { customerId } = await ensureStripeCustomer(
    active.workspace,
    user.email,
    repo,
  );

  const appUrl = getAppUrl();
  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/settings/billing`,
  });

  return NextResponse.json({ url: session.url });
}
