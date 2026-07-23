import { decryptSecret, encryptSecret } from "@/lib/commerce/crypto";
import { XAdsClient, type XAdsClientCredentials } from "./client";
import { refreshXAdsAccessToken } from "./oauth";
import type {
  AdConnectionRecord,
  AdConnectionRepository,
} from "@/repositories/ad-connections";
import { getAdConnectionRepository } from "@/repositories";

export { toPublicAdConnection } from "@/lib/channels/ad-connection";

export async function createXAdsClientFromConnection(
  connection: AdConnectionRecord,
  connectionRepo?: AdConnectionRepository,
): Promise<XAdsClient> {
  if (!connection.externalAccountId) {
    throw new Error("X Ads connection has no account selected.");
  }
  if (connection.status !== "active") {
    throw new Error("X Ads connection is not active.");
  }

  let refreshToken = decryptSecret(connection.refreshToken);
  let accessToken = connection.accessToken
    ? decryptSecret(connection.accessToken)
    : "";
  const expiresAt = connection.tokenExpiresAt
    ? Date.parse(connection.tokenExpiresAt)
    : 0;
  const needsRefresh =
    !accessToken || !expiresAt || expiresAt < Date.now() + 60_000;

  const repo = connectionRepo ?? (await getAdConnectionRepository());

  const persistTokens = async (tokens: {
    accessToken: string;
    expiresAt: string;
    refreshToken?: string;
  }) => {
    await repo.updateTokens(connection.id, {
      accessToken: encryptSecret(tokens.accessToken),
      tokenExpiresAt: tokens.expiresAt,
    });
    if (tokens.refreshToken) {
      await repo.upsertConnection({
        ...connection,
        refreshToken: encryptSecret(tokens.refreshToken),
        accessToken: encryptSecret(tokens.accessToken),
        tokenExpiresAt: tokens.expiresAt,
        updatedAt: new Date().toISOString(),
      });
      refreshToken = tokens.refreshToken;
    }
  };

  if (needsRefresh) {
    const refreshed = await refreshXAdsAccessToken(refreshToken);
    accessToken = refreshed.accessToken;
    refreshToken = refreshed.refreshToken;
    await persistTokens({
      accessToken: refreshed.accessToken,
      expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
      refreshToken: refreshed.refreshToken,
    });
  }

  const creds: XAdsClientCredentials = {
    accessToken,
    refreshToken,
    accountId: connection.externalAccountId,
    onTokenRefresh: async (tokens) => {
      await persistTokens(tokens);
    },
  };

  return new XAdsClient(creds);
}
