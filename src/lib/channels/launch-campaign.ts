import type { AdChannelProvider, Campaign, WorkspacePlan } from "@/domain";
import { createAmazonAdsClientFromConnection } from "@/lib/channels/providers/amazon-ads/session";
import { normalizeCustomerId } from "@/lib/channels/providers/google-ads/format";
import { createGoogleAdsClientFromConnection } from "@/lib/channels/providers/google-ads/session";
import { createMetaClientFromConnection } from "@/lib/channels/providers/meta/session";
import { createTikTokClientFromConnection } from "@/lib/channels/providers/tiktok/session";
import { createXAdsClientFromConnection } from "@/lib/channels/providers/x-ads/session";
import { chargeAdSpend } from "@/lib/wallet/ad-spend";
import {
  getAdConnectionWriteRepository,
  getPerformanceWriteRepository,
} from "@/repositories";
import type { AdConnectionRecord } from "@/repositories/ad-connections";

const PROVIDER_ALIASES: Record<string, AdChannelProvider> = {
  google: "google",
  "google-ads": "google",
  googleads: "google",
  google_ads: "google",
  meta: "meta",
  facebook: "meta",
  "meta-ads": "meta",
  metaads: "meta",
  tiktok: "tiktok",
  "tiktok-ads": "tiktok",
  amazon: "amazon",
  "amazon-ads": "amazon",
  amazonads: "amazon",
  amazon_ads: "amazon",
  x: "x",
  twitter: "x",
  "x-ads": "x",
  xads: "x",
};

export function normalizeChannelProvider(
  channel: string,
): AdChannelProvider | null {
  const key = channel
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/ads$/, "")
    .replace(/-+$/g, "")
    .replace(/-+/g, "-");
  const compact = channel.trim().toLowerCase().replace(/[\s_-]+/g, "");
  return (
    PROVIDER_ALIASES[channel.trim().toLowerCase()] ??
    PROVIDER_ALIASES[key] ??
    PROVIDER_ALIASES[compact] ??
    null
  );
}

export type LaunchExternalCampaignResult = {
  provider: AdChannelProvider;
  connectionId: string;
  externalCampaignId: string;
  name: string;
};

/** Create paused campaigns on connected ad platforms for a product campaign. */
export async function launchCampaignToConnectedChannels(input: {
  workspaceId: string;
  productId: string;
  campaign: Campaign;
  /** Channels to target; defaults to campaign.channels or all active connections. */
  channels?: string[];
  dailyBudget?: number;
}): Promise<LaunchExternalCampaignResult[]> {
  const connections = getAdConnectionWriteRepository();
  const performance = getPerformanceWriteRepository();
  const active = await connections.listConnections(input.workspaceId);
  const ready = active.filter(
    (c): c is typeof c & { externalAccountId: string } =>
      c.status === "active" && Boolean(c.externalAccountId),
  );

  const wanted = new Set(
    (input.channels?.length ? input.channels : input.campaign.channels)
      .map(normalizeChannelProvider)
      .filter((p): p is AdChannelProvider => p != null),
  );

  const targets = ready.filter((c) => {
    if (wanted.size === 0) return true;
    return wanted.has(c.provider);
  });

  const results: LaunchExternalCampaignResult[] = [];
  const dailyBudget = input.dailyBudget ?? 20;

  for (const publicConn of targets) {
    const connection = await connections.getConnection(publicConn.id);
    if (!connection) continue;

    try {
      const created = await createExternalCampaignOnProvider({
        connection,
        name: input.campaign.name,
        dailyBudget,
        objective: input.campaign.objective,
      });
      await performance.upsertLinkedExternalCampaign({
        workspaceId: input.workspaceId,
        connectionId: connection.id,
        provider: connection.provider,
        externalId: created.externalCampaignId,
        name: input.campaign.name,
        status: created.status,
        channelType: created.channelType,
        currencyCode: connection.currencyCode ?? null,
        productId: input.productId,
        campaignId: input.campaign.id,
      });
      results.push({
        provider: connection.provider,
        connectionId: connection.id,
        externalCampaignId: created.externalCampaignId,
        name: input.campaign.name,
      });
    } catch (error) {
      // Best-effort per channel; continue others.
      console.error(
        `Failed to launch ${connection.provider} campaign:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return results;
}

async function createExternalCampaignOnProvider(input: {
  connection: AdConnectionRecord;
  name: string;
  dailyBudget: number;
  objective?: string;
}): Promise<{
  externalCampaignId: string;
  status: string;
  channelType: string;
}> {
  const connections = getAdConnectionWriteRepository();
  switch (input.connection.provider) {
    case "google": {
      const client = await createGoogleAdsClientFromConnection(
        input.connection,
        connections,
      );
      const created = await client.createCampaign({
        name: input.name,
        channelType: "SEARCH",
        status: "PAUSED",
        dailyBudget: input.dailyBudget,
      });
      const id = created.campaignResourceName.split("/").pop() ?? "";
      return {
        externalCampaignId: id,
        status: "PAUSED",
        channelType: "SEARCH",
      };
    }
    case "meta": {
      const client = await createMetaClientFromConnection(
        input.connection,
        connections,
      );
      const created = await client.createCampaign({
        name: input.name,
        status: "PAUSED",
        dailyBudget: input.dailyBudget,
        objective: "OUTCOME_TRAFFIC",
      });
      return {
        externalCampaignId: created.id,
        status: "PAUSED",
        channelType: "META",
      };
    }
    case "tiktok": {
      const client = await createTikTokClientFromConnection(
        input.connection,
        connections,
      );
      const created = await client.createCampaign({
        name: input.name,
        budget: input.dailyBudget,
        status: "DISABLE",
      });
      return {
        externalCampaignId: created.id,
        status: "DISABLE",
        channelType: "TIKTOK",
      };
    }
    case "amazon": {
      const client = await createAmazonAdsClientFromConnection(
        input.connection,
        connections,
      );
      const created = await client.createCampaign({
        name: input.name,
        dailyBudget: input.dailyBudget,
        state: "paused",
      });
      return {
        externalCampaignId: created.id,
        status: "paused",
        channelType: "SP",
      };
    }
    case "x": {
      const client = await createXAdsClientFromConnection(
        input.connection,
        connections,
      );
      const created = await client.createCampaign({
        name: input.name,
        dailyBudget: input.dailyBudget,
        status: "PAUSED",
      });
      return {
        externalCampaignId: created.id,
        status: "PAUSED",
        channelType: "X",
      };
    }
    default:
      throw new Error(`Unsupported provider: ${input.connection.provider}`);
  }
}

/** Enable linked external campaigns and debit first-day budget from the wallet. */
export async function activateCampaignSpend(input: {
  workspaceId: string;
  plan: WorkspacePlan;
  productId: string;
  campaignId: string;
  userId?: string | null;
  /** Total first-day budget in cents across channels. */
  amountCents: number;
}): Promise<void> {
  await chargeAdSpend({
    workspaceId: input.workspaceId,
    plan: input.plan,
    amountCents: input.amountCents,
    userId: input.userId,
    description: `Launch campaign ${input.campaignId}`,
    metadata: {
      productId: input.productId,
      campaignId: input.campaignId,
    },
  });

  const performance = getPerformanceWriteRepository();
  const connections = getAdConnectionWriteRepository();
  const externals = await performance.listExternalCampaigns(input.workspaceId, {
    productId: input.productId,
  });
  const linked = externals.filter((c) => c.campaignId === input.campaignId);

  for (const external of linked) {
    const connection = await connections.getConnection(external.connectionId);
    if (!connection) continue;
    try {
      await setExternalCampaignActive(connection, external.externalId, true);
      await performance.upsertLinkedExternalCampaign({
        workspaceId: input.workspaceId,
        connectionId: connection.id,
        provider: connection.provider,
        externalId: external.externalId,
        name: external.name,
        status: "ACTIVE",
        channelType: external.channelType,
        currencyCode: external.currencyCode,
        productId: input.productId,
        campaignId: input.campaignId,
      });
    } catch (error) {
      console.error(
        `Failed to activate ${connection.provider} campaign ${external.externalId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

async function setExternalCampaignActive(
  connection: AdConnectionRecord,
  externalId: string,
  active: boolean,
): Promise<void> {
  const connections = getAdConnectionWriteRepository();
  switch (connection.provider) {
    case "google": {
      const client = await createGoogleAdsClientFromConnection(
        connection,
        connections,
      );
      const customerId = normalizeCustomerId(connection.externalAccountId!);
      const resourceName = `customers/${customerId}/campaigns/${externalId}`;
      await client.updateCampaignStatus(
        resourceName,
        active ? "ENABLED" : "PAUSED",
      );
      break;
    }
    case "meta": {
      const client = await createMetaClientFromConnection(
        connection,
        connections,
      );
      await client.updateCampaignStatus(
        externalId,
        active ? "ACTIVE" : "PAUSED",
      );
      break;
    }
    case "tiktok": {
      const client = await createTikTokClientFromConnection(
        connection,
        connections,
      );
      await client.updateCampaignStatus(
        externalId,
        active ? "ENABLE" : "DISABLE",
      );
      break;
    }
    case "amazon": {
      const client = await createAmazonAdsClientFromConnection(
        connection,
        connections,
      );
      await client.updateCampaignStatus(
        externalId,
        active ? "enabled" : "paused",
      );
      break;
    }
    case "x": {
      const client = await createXAdsClientFromConnection(
        connection,
        connections,
      );
      await client.updateCampaignStatus(
        externalId,
        active ? "ACTIVE" : "PAUSED",
      );
      break;
    }
  }
}
