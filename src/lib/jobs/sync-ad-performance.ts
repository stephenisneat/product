import type { SyncAdPerformanceJobInput } from "@/domain";
import {
  assertTriggerJobEnv,
  clarifyTriggerSupabaseError,
} from "@/lib/jobs/assert-trigger-env";
import { unknownErrorMessage } from "@/lib/errors";
import { syncDateRange } from "@/lib/performance/date-range";
import { getPerformanceProvider } from "@/lib/performance/providers";
import { createAmazonAdsClientFromConnection } from "@/lib/channels/providers/amazon-ads/session";
import { createGoogleAdsClientFromConnection } from "@/lib/channels/providers/google-ads/session";
import { createMetaClientFromConnection } from "@/lib/channels/providers/meta/session";
import { createTikTokClientFromConnection } from "@/lib/channels/providers/tiktok/session";
import { createXAdsClientFromConnection } from "@/lib/channels/providers/x-ads/session";
import {
  getAdConnectionWriteRepository,
  getJobWriteRepository,
  getPerformanceWriteRepository,
} from "@/repositories";
import type { AdConnectionRecord } from "@/repositories/ad-connections";

export type SyncAdPerformanceJobPayload = {
  jobRunId: string;
  workspaceId: string;
  createdBy: string | null;
  connectionId: string;
  backfill?: boolean;
};

export function payloadFromSyncAdPerformanceInput(
  jobRunId: string,
  workspaceId: string,
  createdBy: string | null,
  input: SyncAdPerformanceJobInput,
): SyncAdPerformanceJobPayload {
  return {
    jobRunId,
    workspaceId,
    createdBy,
    connectionId: input.connectionId,
    backfill: input.backfill,
  };
}

async function credentialsForConnection(
  connection: AdConnectionRecord,
): Promise<unknown> {
  const connections = getAdConnectionWriteRepository();
  switch (connection.provider) {
    case "google":
      return createGoogleAdsClientFromConnection(connection, connections);
    case "meta":
      return createMetaClientFromConnection(connection, connections);
    case "tiktok":
      return createTikTokClientFromConnection(connection, connections);
    case "amazon":
      return createAmazonAdsClientFromConnection(connection, connections);
    case "x":
      return createXAdsClientFromConnection(connection, connections);
    default:
      return null;
  }
}

export async function runSyncAdPerformanceJob(
  payload: SyncAdPerformanceJobPayload,
): Promise<{
  connectionId: string;
  supported: boolean;
  campaignCount: number;
  pointCount: number;
  reason?: string;
}> {
  assertTriggerJobEnv();

  const jobs = getJobWriteRepository();
  const connections = getAdConnectionWriteRepository();
  const performance = getPerformanceWriteRepository();

  await jobs.update(payload.jobRunId, {
    status: "running",
    startedAt: new Date().toISOString(),
  });

  try {
    const connection = await connections.getConnection(payload.connectionId);
    if (!connection || connection.workspaceId !== payload.workspaceId) {
      throw new Error("Ad connection not found in workspace.");
    }
    if (connection.status !== "active" || !connection.externalAccountId) {
      throw new Error("Ad connection is not ready for performance sync.");
    }

    const lastSyncedAt =
      typeof connection.metadata.last_performance_sync_at === "string"
        ? connection.metadata.last_performance_sync_at
        : null;
    const range = syncDateRange({
      backfill: payload.backfill,
      lastSyncedAt,
    });

    const provider = getPerformanceProvider(connection.provider);
    const credentials = await credentialsForConnection(connection);

    const fetchResult = await provider.fetchDailyCampaignMetrics(
      {
        connectionId: connection.id,
        workspaceId: connection.workspaceId,
        externalAccountId: connection.externalAccountId,
        currencyCode: connection.currencyCode ?? null,
        credentials,
      },
      range,
    );

    if (!fetchResult.supported) {
      const result = {
        connectionId: connection.id,
        supported: false as const,
        campaignCount: 0,
        pointCount: 0,
        reason: fetchResult.reason,
      };
      await connections.patchMetadata(connection.id, {
        last_performance_sync_at: new Date().toISOString(),
        last_performance_sync_error: fetchResult.reason,
        last_performance_sync_supported: false,
      });
      await jobs.update(payload.jobRunId, {
        status: "succeeded",
        result,
        finishedAt: new Date().toISOString(),
      });
      return result;
    }

    const syncedAt = new Date().toISOString();
    const upserted = await performance.upsertSyncRows({
      workspaceId: connection.workspaceId,
      connectionId: connection.id,
      provider: connection.provider,
      currencyCode: connection.currencyCode ?? null,
      rows: fetchResult.rows,
      syncedAt,
    });

    await connections.patchMetadata(connection.id, {
      last_performance_sync_at: syncedAt,
      last_performance_sync_error: null,
      last_performance_sync_supported: true,
      last_performance_sync_range: range,
      last_performance_campaign_count: upserted.campaignCount,
      last_performance_point_count: upserted.pointCount,
    });

    const result = {
      connectionId: connection.id,
      supported: true as const,
      campaignCount: upserted.campaignCount,
      pointCount: upserted.pointCount,
    };

    await jobs.update(payload.jobRunId, {
      status: "succeeded",
      result,
      finishedAt: new Date().toISOString(),
    });

    return result;
  } catch (error) {
    const message = clarifyTriggerSupabaseError(unknownErrorMessage(error));
    try {
      await getAdConnectionWriteRepository().patchMetadata(
        payload.connectionId,
        {
          last_performance_sync_error: message,
          last_performance_sync_at: new Date().toISOString(),
        },
      );
    } catch {
      // Best-effort metadata update.
    }
    await jobs.update(payload.jobRunId, {
      status: "failed",
      error: message,
      finishedAt: new Date().toISOString(),
    });
    throw error;
  }
}
