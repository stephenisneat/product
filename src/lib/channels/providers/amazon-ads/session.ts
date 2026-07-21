import { decryptSecret, encryptSecret } from "@/lib/commerce/crypto";
import {
  AmazonAdsClient,
  type AmazonAdsClientCredentials,
} from "./client";
import { refreshAmazonAdsAccessToken } from "./oauth";
import type { AdConnectionRecord } from "@/repositories/ad-connections";
import { getAdConnectionRepository } from "@/repositories";

export { toPublicAdConnection } from "@/lib/channels/ad-connection";

export async function createAmazonAdsClientFromConnection(
  connection: AdConnectionRecord,
): Promise<AmazonAdsClient> {
  if (!connection.externalAccountId) {
    throw new Error("Amazon Ads connection has no profile selected.");
  }
  if (connection.status !== "active") {
    throw new Error("Amazon Ads connection is not active.");
  }

  const refreshToken = decryptSecret(connection.refreshToken);
  let accessToken = connection.accessToken
    ? decryptSecret(connection.accessToken)
    : "";
  const expiresAt = connection.tokenExpiresAt
    ? Date.parse(connection.tokenExpiresAt)
    : 0;
  const needsRefresh =
    !accessToken || !expiresAt || expiresAt < Date.now() + 60_000;

  const repo = await getAdConnectionRepository();

  const persistTokens = async (tokens: {
    accessToken: string;
    expiresAt: string;
  }) => {
    await repo.updateTokens(connection.id, {
      accessToken: encryptSecret(tokens.accessToken),
      tokenExpiresAt: tokens.expiresAt,
    });
  };

  if (needsRefresh) {
    const refreshed = await refreshAmazonAdsAccessToken(refreshToken);
    accessToken = refreshed.accessToken;
    await persistTokens({
      accessToken: refreshed.accessToken,
      expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
    });
  }

  const creds: AmazonAdsClientCredentials = {
    accessToken,
    refreshToken,
    profileId: connection.externalAccountId,
    onTokenRefresh: async (tokens) => {
      await persistTokens(tokens);
    },
  };

  return new AmazonAdsClient(creds);
}
