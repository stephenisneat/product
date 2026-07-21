import { decryptSecret, encryptSecret } from "@/lib/commerce/crypto";
import {
  GoogleAdsClient,
  refreshGoogleAdsAccessToken,
  type GoogleAdsClientCredentials,
} from "@/lib/channels/providers/google-ads";
import type { AdConnectionRecord } from "@/repositories/ad-connections";
import { getAdConnectionRepository } from "@/repositories";

export { toPublicAdConnection } from "@/lib/channels/ad-connection";

/** Build an authenticated Google Ads client from a stored connection. */
export async function createGoogleAdsClientFromConnection(
  connection: AdConnectionRecord,
): Promise<GoogleAdsClient> {
  if (!connection.externalAccountId) {
    throw new Error("Google Ads connection has no customer account selected.");
  }
  if (connection.status !== "active") {
    throw new Error("Google Ads connection is not active.");
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
    const refreshed = await refreshGoogleAdsAccessToken(refreshToken);
    accessToken = refreshed.accessToken;
    await persistTokens({
      accessToken: refreshed.accessToken,
      expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
    });
  }

  const creds: GoogleAdsClientCredentials = {
    accessToken,
    refreshToken,
    customerId: connection.externalAccountId,
    loginCustomerId: connection.loginCustomerId,
    onTokenRefresh: async (tokens) => {
      await persistTokens(tokens);
    },
  };

  return new GoogleAdsClient(creds);
}
