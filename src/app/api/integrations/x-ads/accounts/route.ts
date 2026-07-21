import { NextResponse } from "next/server";
import { decryptSecret, encryptSecret } from "@/lib/commerce/crypto";
import { requireAdChannelAdmin } from "@/lib/channels/ad-channel-auth";
import {
  hasXAdsConfig,
  refreshXAdsAccessToken,
  XAdsClient,
} from "@/lib/channels/providers/x-ads";
import { createAdConnectionId } from "@/lib/products/slugify";
import { getAdConnectionRepository } from "@/repositories";
import { z } from "zod";

/** List X Ads accounts accessible via the pending OAuth credential. */
export async function GET() {
  const auth = await requireAdChannelAdmin("X Ads");
  if ("error" in auth) return auth.error;

  if (!hasXAdsConfig()) {
    return NextResponse.json(
      { error: "X Ads is not configured." },
      { status: 503 },
    );
  }

  try {
    const repo = await getAdConnectionRepository();
    const pending = await repo.getPendingConnection(auth.active.workspace.id, "x");
    if (!pending) {
      return NextResponse.json(
        { error: "No pending X Ads connection. Connect X Ads first." },
        { status: 404 },
      );
    }

    let refreshToken = decryptSecret(pending.refreshToken);
    let accessToken = pending.accessToken
      ? decryptSecret(pending.accessToken)
      : "";
    const expiresAt = pending.tokenExpiresAt
      ? Date.parse(pending.tokenExpiresAt)
      : 0;
    if (!accessToken || expiresAt < Date.now() + 60_000) {
      const refreshed = await refreshXAdsAccessToken(refreshToken);
      accessToken = refreshed.accessToken;
      refreshToken = refreshed.refreshToken;
      await repo.updateTokens(pending.id, {
        accessToken: encryptSecret(refreshed.accessToken),
        tokenExpiresAt: new Date(
          Date.now() + refreshed.expiresIn * 1000,
        ).toISOString(),
      });
      if (refreshed.refreshToken !== decryptSecret(pending.refreshToken)) {
        await repo.upsertConnection({
          ...pending,
          refreshToken: encryptSecret(refreshed.refreshToken),
          accessToken: encryptSecret(refreshed.accessToken),
          tokenExpiresAt: new Date(
            Date.now() + refreshed.expiresIn * 1000,
          ).toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    const accounts = await XAdsClient.listAccounts(accessToken);
    const linked = await repo.listActiveByProvider(auth.active.workspace.id, "x");
    const linkedIds = new Set(
      linked.map((c) => c.externalAccountId).filter(Boolean),
    );

    return NextResponse.json({
      accounts: accounts.map((account) => ({
        accountId: account.accountId,
        name: account.name,
        currencyCode: account.currencyCode,
        timeZone: account.timeZone,
        linked: linkedIds.has(account.accountId),
      })),
      pendingConnectionId: pending.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list X Ads accounts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const linkSchema = z.object({
  accountIds: z.array(z.string().min(1)).min(1),
});

/** Link one or more X Ads accounts to the workspace. */
export async function POST(request: Request) {
  const auth = await requireAdChannelAdmin("X Ads");
  if ("error" in auth) return auth.error;

  let body: z.infer<typeof linkSchema>;
  try {
    body = linkSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Provide accountIds: string[]" },
      { status: 400 },
    );
  }

  try {
    const repo = await getAdConnectionRepository();
    const pending = await repo.getPendingConnection(auth.active.workspace.id, "x");
    if (!pending) {
      return NextResponse.json(
        { error: "No pending X Ads connection. Connect X Ads first." },
        { status: 404 },
      );
    }

    const refreshToken = decryptSecret(pending.refreshToken);
    let accessToken = pending.accessToken
      ? decryptSecret(pending.accessToken)
      : "";
    if (!accessToken) {
      const refreshed = await refreshXAdsAccessToken(refreshToken);
      accessToken = refreshed.accessToken;
    }

    const client = new XAdsClient({ accessToken, refreshToken });
    const linked = [];
    const now = new Date().toISOString();

    for (const accountId of body.accountIds) {
      let detail = {
        accountId,
        name: `Account ${accountId}`,
        currencyCode: null as string | null,
        timeZone: null as string | null,
      };
      try {
        const fetched = await client.getAccount(accountId);
        detail = {
          accountId: fetched.accountId,
          name: fetched.name,
          currencyCode: fetched.currencyCode,
          timeZone: fetched.timeZone,
        };
      } catch {
        // Keep fallback name if detail fetch fails.
      }

      const connection = await repo.upsertConnection({
        id: createAdConnectionId(),
        workspaceId: auth.active.workspace.id,
        provider: "x",
        externalAccountId: detail.accountId,
        loginCustomerId: null,
        accountName: detail.name,
        currencyCode: detail.currencyCode,
        timeZone: detail.timeZone,
        isManager: false,
        refreshToken: pending.refreshToken,
        accessToken: pending.accessToken,
        tokenExpiresAt: pending.tokenExpiresAt,
        scope: pending.scope,
        status: "active",
        connectedBy: auth.user.id,
        metadata: { channels: ["PROMOTED_TWEETS"] },
        createdAt: now,
        updatedAt: now,
      });
      linked.push(connection);
    }

    await repo.deleteConnection(pending.id);
    return NextResponse.json({ connections: linked });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to link X Ads accounts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
