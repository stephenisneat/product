import { decryptSecret, encryptSecret } from "@/lib/commerce/crypto";
import { MetaClient, type MetaClientCredentials } from "./client";
import { refreshMetaAccessToken } from "./oauth";
import type {
  AdConnectionRecord,
  AdConnectionRepository,
} from "@/repositories/ad-connections";
import { getAdConnectionRepository } from "@/repositories";

export { toPublicAdConnection } from "@/lib/channels/ad-connection";

export async function createMetaClientFromConnection(
  connection: AdConnectionRecord,
  connectionRepo?: AdConnectionRepository,
): Promise<MetaClient> {
  if (!connection.externalAccountId) {
    throw new Error("Meta connection has no ad account selected.");
  }
  if (connection.status !== "active") {
    throw new Error("Meta connection is not active.");
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
    const refreshed = await refreshMetaAccessToken(refreshToken);
    accessToken = refreshed.accessToken;
    await persistTokens({
      accessToken: refreshed.accessToken,
      expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
    });
  }

  const creds: MetaClientCredentials = {
    accessToken,
    refreshToken,
    accountId: connection.externalAccountId,
    onTokenRefresh: async (tokens) => {
      await persistTokens(tokens);
    },
  };

  return new MetaClient(creds);
}
