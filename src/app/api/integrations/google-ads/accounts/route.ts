import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageMembers, getActiveWorkspace } from "@/lib/auth/workspace";
import { decryptSecret, encryptSecret } from "@/lib/commerce/crypto";
import {
  GoogleAdsClient,
  hasGoogleAdsConfig,
  normalizeCustomerId,
  refreshGoogleAdsAccessToken,
} from "@/lib/channels/providers/google-ads";
import { createAdConnectionId } from "@/lib/products/slugify";
import { getAdConnectionRepository } from "@/repositories";
import { z } from "zod";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const active = await getActiveWorkspace();
  if (!active) {
    return {
      error: NextResponse.json({ error: "No workspace available" }, { status: 400 }),
    };
  }
  if (!canManageMembers(active.role)) {
    return {
      error: NextResponse.json(
        { error: "Only workspace owners and admins can manage Google Ads." },
        { status: 403 },
      ),
    };
  }
  return { user, active };
}

/** List Google Ads accounts accessible via the pending OAuth credential. */
export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;
  const { active } = auth as Exclude<Awaited<ReturnType<typeof requireAdmin>>, { error: NextResponse }>;

  if (!hasGoogleAdsConfig()) {
    return NextResponse.json(
      { error: "Google Ads is not configured." },
      { status: 503 },
    );
  }

  try {
    const repo = await getAdConnectionRepository();
    const pending = await repo.getPendingConnection(active.workspace.id, "google");
    if (!pending) {
      return NextResponse.json(
        { error: "No pending Google Ads connection. Connect Google Ads first." },
        { status: 404 },
      );
    }

    const refreshToken = decryptSecret(pending.refreshToken);
    let accessToken = pending.accessToken
      ? decryptSecret(pending.accessToken)
      : "";
    const expiresAt = pending.tokenExpiresAt
      ? Date.parse(pending.tokenExpiresAt)
      : 0;
    if (!accessToken || expiresAt < Date.now() + 60_000) {
      const refreshed = await refreshGoogleAdsAccessToken(refreshToken);
      accessToken = refreshed.accessToken;
      await repo.updateTokens(pending.id, {
        accessToken: encryptSecret(refreshed.accessToken),
        tokenExpiresAt: new Date(
          Date.now() + refreshed.expiresIn * 1000,
        ).toISOString(),
      });
    }

    const accessible =
      await GoogleAdsClient.listAccessibleCustomers(accessToken);

    const byId = new Map<
      string,
      {
        customerId: string;
        descriptiveName: string;
        currencyCode: string | null;
        timeZone: string | null;
        manager: boolean;
        testAccount: boolean;
      }
    >();

    for (const account of accessible) {
      try {
        const client = new GoogleAdsClient({
          accessToken,
          refreshToken,
          customerId: account.customerId,
          loginCustomerId: null,
        });
        const detail = await client.getCustomer(account.customerId);
        byId.set(detail.customerId, {
          customerId: detail.customerId,
          descriptiveName: detail.descriptiveName,
          currencyCode: detail.currencyCode,
          timeZone: detail.timeZone,
          manager: detail.manager,
          testAccount: detail.testAccount,
        });

        if (detail.manager) {
          try {
            const clients = await client.listClientCustomers();
            for (const child of clients) {
              if (!byId.has(child.customerId)) {
                byId.set(child.customerId, {
                  customerId: child.customerId,
                  descriptiveName: child.descriptiveName,
                  currencyCode: child.currencyCode,
                  timeZone: child.timeZone,
                  manager: child.manager,
                  testAccount: child.testAccount,
                });
              }
            }
          } catch {
            // Manager without client listing permission — keep the MCC itself.
          }
        }
      } catch {
        byId.set(account.customerId, {
          customerId: account.customerId,
          descriptiveName: `Account ${account.customerId}`,
          currencyCode: null,
          timeZone: null,
          manager: false,
          testAccount: false,
        });
      }
    }

    const details = [...byId.values()];

    const linked = await repo.listActiveByProvider(active.workspace.id, "google");
    const linkedIds = new Set(
      linked.map((c) => c.externalAccountId).filter(Boolean),
    );

    return NextResponse.json({
      accounts: details.map((account) => ({
        ...account,
        linked: linkedIds.has(account.customerId),
      })),
      pendingConnectionId: pending.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list Google Ads accounts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const linkSchema = z.object({
  customerIds: z.array(z.string().min(1)).min(1),
  /** Optional MCC to use as login-customer-id for client accounts. */
  loginCustomerId: z.string().optional().nullable(),
});

/** Link one or more accessible customer accounts to the workspace. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;
  const { user, active } = auth as Exclude<
    Awaited<ReturnType<typeof requireAdmin>>,
    { error: NextResponse }
  >;

  let body: z.infer<typeof linkSchema>;
  try {
    body = linkSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Provide customerIds: string[]" },
      { status: 400 },
    );
  }

  try {
    const repo = await getAdConnectionRepository();
    const pending = await repo.getPendingConnection(active.workspace.id, "google");
    if (!pending) {
      return NextResponse.json(
        { error: "No pending Google Ads connection. Connect Google Ads first." },
        { status: 404 },
      );
    }

    const refreshToken = decryptSecret(pending.refreshToken);
    let accessToken = pending.accessToken
      ? decryptSecret(pending.accessToken)
      : "";
    if (!accessToken) {
      const refreshed = await refreshGoogleAdsAccessToken(refreshToken);
      accessToken = refreshed.accessToken;
    }

    const loginCustomerId = body.loginCustomerId
      ? normalizeCustomerId(body.loginCustomerId)
      : null;

    const linked = [];
    const now = new Date().toISOString();

    for (const rawId of body.customerIds) {
      const customerId = normalizeCustomerId(rawId);
      let detail = {
        customerId,
        descriptiveName: `Account ${customerId}`,
        currencyCode: null as string | null,
        timeZone: null as string | null,
        manager: false,
      };
      try {
        const client = new GoogleAdsClient({
          accessToken,
          refreshToken,
          customerId,
          loginCustomerId,
        });
        const fetched = await client.getCustomer(customerId);
        detail = {
          customerId: fetched.customerId,
          descriptiveName: fetched.descriptiveName || `Account ${customerId}`,
          currencyCode: fetched.currencyCode,
          timeZone: fetched.timeZone,
          manager: fetched.manager,
        };
      } catch {
        // Keep fallback name if detail fetch fails (e.g. manager-only access).
      }

      const connection = await repo.upsertConnection({
        id: createAdConnectionId(),
        workspaceId: active.workspace.id,
        provider: "google",
        externalAccountId: detail.customerId,
        loginCustomerId,
        accountName: detail.descriptiveName,
        currencyCode: detail.currencyCode,
        timeZone: detail.timeZone,
        isManager: detail.manager,
        refreshToken: pending.refreshToken,
        accessToken: pending.accessToken,
        tokenExpiresAt: pending.tokenExpiresAt,
        scope: pending.scope,
        status: "active",
        connectedBy: user.id,
        metadata: {
          channels: ["SEARCH", "DISPLAY", "VIDEO"],
        },
        createdAt: now,
        updatedAt: now,
      });
      linked.push(connection);
    }

    // Clear the pending credential row once accounts are linked.
    await repo.deleteConnection(pending.id);

    return NextResponse.json({ connections: linked });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to link Google Ads accounts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
