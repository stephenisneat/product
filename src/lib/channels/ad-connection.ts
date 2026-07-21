import type { AdConnection } from "@/domain";
import type { AdConnectionRecord } from "@/repositories/ad-connections";

/** Strip secrets before returning an ad connection to the client. */
export function toPublicAdConnection(
  connection: AdConnectionRecord | AdConnection,
): AdConnection {
  return {
    id: connection.id,
    workspaceId: connection.workspaceId,
    provider: connection.provider,
    externalAccountId: connection.externalAccountId,
    loginCustomerId: connection.loginCustomerId,
    accountName: connection.accountName,
    currencyCode: connection.currencyCode,
    timeZone: connection.timeZone,
    isManager: connection.isManager,
    scope: connection.scope,
    status: connection.status,
    connectedBy: connection.connectedBy,
    metadata: connection.metadata,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}

export function cookieSecure() {
  return (
    process.env.COOKIE_SECURE === "true" ||
    process.env.VERCEL === "1" ||
    process.env.NODE_ENV === "production"
  );
}
