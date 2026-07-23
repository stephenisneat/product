import { decryptSecret, encryptSecret } from "@/lib/commerce/crypto";
import { TikTokClient, type TikTokClientCredentials } from "./client";
import { refreshTikTokAccessToken } from "./oauth";
import type {
  AdConnectionRecord,
  AdConnectionRepository,
} from "@/repositories/ad-connections";
import { getAdConnectionRepository } from "@/repositories";

export { toPublicAdConnection } from "@/lib/channels/ad-connection";

export async function createTikTokClientFromConnection(
  connection: AdConnectionRecord,
  connectionRepo?: AdConnectionRepository,
): Promise<TikTokClient> {
  if (!connection.externalAccountId) {
    throw new Error("TikTok connection has no advertiser selected.");
  }
  if (connection.status !== "active") {
    throw new Error("TikTok connection is not active.");
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

  const repo = connectionRepo ?? (await getAdConnectionRepository());

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
    const refreshed = await refreshTikTokAccessToken(refreshToken);
    accessToken = refreshed.accessToken;
    await persistTokens({
      accessToken: refreshed.accessToken,
      expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
    });
  }

  const creds: TikTokClientCredentials = {
    accessToken,
    refreshToken,
    advertiserId: connection.externalAccountId,
    onTokenRefresh: async (tokens) => {
      await persistTokens(tokens);
    },
  };

  return new TikTokClient(creds);
}
