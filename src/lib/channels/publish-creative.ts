import type { Creative, WorkspacePlan } from "@/domain";
import { createGoogleAdsClientFromConnection } from "@/lib/channels/providers/google-ads/session";
import { createMetaClientFromConnection } from "@/lib/channels/providers/meta/session";
import { chargeAdSpend } from "@/lib/wallet/ad-spend";
import {
  getAdConnectionWriteRepository,
  getCreativeWriteRepository,
  getPerformanceWriteRepository,
} from "@/repositories";
import type { AdConnectionRecord } from "@/repositories/ad-connections";

export type PublishCreativeInput = {
  workspaceId: string;
  plan: WorkspacePlan;
  creative: Creative;
  provider: "google" | "meta";
  connectionId: string;
  finalUrl: string;
  dailyBudget?: number;
  /** Debit wallet for first-day budget when true. */
  chargeSpend?: boolean;
  userId?: string | null;
  /** Required for Meta link ads. */
  metaPageId?: string;
  /** Optional YouTube video id for Google video creatives. */
  youtubeVideoId?: string;
};

export type PublishCreativeResult = {
  provider: "google" | "meta";
  externalCampaignId: string;
  externalAdId: string;
  creative: Creative;
};

function mutateResourceName(result: unknown): string {
  const body = result as {
    results?: { resourceName?: string }[];
  };
  const name = body.results?.[0]?.resourceName;
  if (!name) {
    throw new Error("Ad platform mutate returned no resource name.");
  }
  return name;
}

async function imageUrlToBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download creative image (${response.status})`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString("base64");
}

/** Push a ready creative into Google Ads or Meta as a paused campaign + ad. */
export async function publishCreativeToChannel(
  input: PublishCreativeInput,
): Promise<PublishCreativeResult> {
  if (input.creative.status !== "ready") {
    throw new Error("Creative must be ready before publishing.");
  }

  const connections = getAdConnectionWriteRepository();
  const connection = await connections.getConnection(input.connectionId);
  if (
    !connection ||
    connection.workspaceId !== input.workspaceId ||
    connection.provider !== input.provider ||
    connection.status !== "active" ||
    !connection.externalAccountId
  ) {
    throw new Error("Ad connection is not ready for publish.");
  }

  const dailyBudget = input.dailyBudget ?? 20;
  let result: PublishCreativeResult;

  if (input.provider === "google") {
    result = await publishToGoogle({
      connection,
      creative: input.creative,
      finalUrl: input.finalUrl,
      dailyBudget,
      youtubeVideoId: input.youtubeVideoId,
    });
  } else {
    result = await publishToMeta({
      connection,
      creative: input.creative,
      finalUrl: input.finalUrl,
      dailyBudget,
      pageId: input.metaPageId,
    });
  }

  const creatives = getCreativeWriteRepository();
  const externalAdRefs = {
    ...input.creative.externalAdRefs,
    ...(input.provider === "google"
      ? { googleAssetId: result.externalAdId }
      : { metaAdId: result.externalAdId }),
  };
  const updated = await creatives.update(input.creative.id, { externalAdRefs });
  result.creative = updated;

  const performance = getPerformanceWriteRepository();
  await performance.upsertLinkedExternalCampaign({
    workspaceId: input.workspaceId,
    connectionId: connection.id,
    provider: connection.provider,
    externalId: result.externalCampaignId,
    name: `${input.creative.title} (${input.provider})`,
    status: "PAUSED",
    channelType: input.creative.kind,
    currencyCode: connection.currencyCode ?? null,
    productId: input.creative.productId,
    campaignId: input.creative.campaignIds[0] ?? null,
  });

  if (input.chargeSpend) {
    await chargeAdSpend({
      workspaceId: input.workspaceId,
      plan: input.plan,
      amountCents: Math.round(dailyBudget * 100),
      userId: input.userId,
      description: `Publish creative ${input.creative.id} to ${input.provider}`,
      metadata: {
        creativeId: input.creative.id,
        provider: input.provider,
        externalAdId: result.externalAdId,
      },
    });
  }

  return result;
}

async function publishToGoogle(input: {
  connection: AdConnectionRecord;
  creative: Creative;
  finalUrl: string;
  dailyBudget: number;
  youtubeVideoId?: string;
}): Promise<PublishCreativeResult> {
  const connections = getAdConnectionWriteRepository();
  const client = await createGoogleAdsClientFromConnection(
    input.connection,
    connections,
  );

  const channelType =
    input.creative.kind === "search_ad"
      ? "SEARCH"
      : input.creative.kind === "video_ad"
        ? "VIDEO"
        : "DISPLAY";

  if (channelType === "VIDEO" && !input.youtubeVideoId) {
    throw new Error(
      "Google video publish requires a YouTube video ID (Ads API cannot host MP4s).",
    );
  }

  const campaign = await client.createCampaign({
    name: input.creative.title.slice(0, 120),
    channelType,
    status: "PAUSED",
    dailyBudget: input.dailyBudget,
    videoCampaignSubtype:
      channelType === "VIDEO" ? "VIDEO_ACTION" : undefined,
  });

  const adGroupResult = await client.createAdGroup({
    campaignResourceName: campaign.campaignResourceName,
    name: `${input.creative.title.slice(0, 80)} ad group`,
    status: "PAUSED",
    type: channelType === "SEARCH" ? "SEARCH_STANDARD" : undefined,
  });
  const adGroupResourceName = mutateResourceName(adGroupResult);

  let adResourceName: string;

  if (input.creative.kind === "search_ad") {
    const copy = input.creative.copy;
    if (!copy) throw new Error("Search creative is missing copy.");
    const keywords = input.creative.keywords?.themes ?? [];
    if (keywords.length > 0) {
      await client.addKeywords(
        adGroupResourceName,
        keywords.slice(0, 20).map((theme) => ({
          text: theme.phrase,
          matchType:
            theme.matchType === "exact"
              ? "EXACT"
              : theme.matchType === "phrase"
                ? "PHRASE"
                : "BROAD",
        })),
      );
    }
    const adResult = await client.createAdGroupAd({
      adGroupResourceName,
      status: "PAUSED",
      responsiveSearchAd: {
        headlines: copy.headlines.slice(0, 15),
        descriptions: copy.descriptions.slice(0, 4),
        path1: copy.path1 || undefined,
        path2: copy.path2 || undefined,
        finalUrls: [copy.finalUrl || input.finalUrl],
      },
    });
    adResourceName = mutateResourceName(adResult);
  } else if (input.creative.kind === "display_ad") {
    const concept = input.creative.concept;
    const assets = input.creative.assets;
    if (!concept || !assets) {
      throw new Error("Display creative is missing concept or assets.");
    }
    const marketingB64 = await imageUrlToBase64(assets.marketingImageUrl);
    const squareB64 = await imageUrlToBase64(assets.squareImageUrl);
    const marketingAsset = mutateResourceName(
      await client.createImageAsset({
        name: `${input.creative.title}-marketing`,
        dataBase64: marketingB64,
      }),
    );
    const squareAsset = mutateResourceName(
      await client.createImageAsset({
        name: `${input.creative.title}-square`,
        dataBase64: squareB64,
      }),
    );
    const adResult = await client.createAdGroupAd({
      adGroupResourceName,
      status: "PAUSED",
      responsiveDisplayAd: {
        headlines: concept.headlines.slice(0, 5),
        longHeadline: concept.longHeadline,
        descriptions: concept.descriptions.slice(0, 5),
        businessName: concept.businessName,
        marketingImageAsset: marketingAsset,
        squareMarketingImageAsset: squareAsset,
        finalUrls: [input.finalUrl],
      },
    });
    adResourceName = mutateResourceName(adResult);
  } else if (input.creative.kind === "video_ad") {
    const videoAsset = mutateResourceName(
      await client.createYoutubeVideoAsset({
        name: `${input.creative.title}-yt`,
        youtubeVideoId: input.youtubeVideoId!,
      }),
    );
    const adResult = await client.createAdGroupAd({
      adGroupResourceName,
      status: "PAUSED",
      videoAd: {
        videoAsset,
        adType: "IN_STREAM",
        finalUrls: [input.finalUrl],
        actionButtonLabel: "Shop now",
        actionHeadline: input.creative.title.slice(0, 25),
      },
    });
    adResourceName = mutateResourceName(adResult);
  } else {
    throw new Error(
      `Google publish does not support creative kind ${input.creative.kind} yet.`,
    );
  }

  return {
    provider: "google",
    externalCampaignId: campaign.campaignResourceName.split("/").pop() ?? "",
    externalAdId: adResourceName.split("/").pop() ?? adResourceName,
    creative: input.creative,
  };
}

async function publishToMeta(input: {
  connection: AdConnectionRecord;
  creative: Creative;
  finalUrl: string;
  dailyBudget: number;
  pageId?: string;
}): Promise<PublishCreativeResult> {
  if (!input.pageId) {
    throw new Error("Meta publish requires a Facebook Page ID (metaPageId).");
  }
  if (
    input.creative.kind !== "display_ad" &&
    input.creative.kind !== "video_ad"
  ) {
    throw new Error("Meta publish currently supports display and video creatives.");
  }

  const connections = getAdConnectionWriteRepository();
  const client = await createMetaClientFromConnection(
    input.connection,
    connections,
  );

  const imageUrl =
    input.creative.assets?.marketingImageUrl ??
    input.creative.video?.thumbnailUrl;
  if (!imageUrl) {
    throw new Error("Creative has no image/thumbnail URL to upload to Meta.");
  }

  const campaign = await client.createCampaign({
    name: input.creative.title.slice(0, 120),
    status: "PAUSED",
    dailyBudget: input.dailyBudget,
    objective: "OUTCOME_TRAFFIC",
  });
  const adSet = await client.createAdSet({
    name: `${input.creative.title.slice(0, 80)} ad set`,
    campaignId: campaign.id,
    dailyBudget: input.dailyBudget,
    status: "PAUSED",
  });
  const { hash } = await client.createAdImageFromUrl(imageUrl);
  const message =
    input.creative.concept?.descriptions[0] ??
    input.creative.brief ??
    input.creative.title;
  const headline =
    input.creative.concept?.headlines[0] ?? input.creative.title.slice(0, 40);

  const ad = await client.createLinkAd({
    name: input.creative.title.slice(0, 120),
    adSetId: adSet.id,
    pageId: input.pageId,
    message,
    link: input.finalUrl,
    imageHash: hash,
    headline,
    description: input.creative.concept?.longHeadline,
    status: "PAUSED",
  });

  return {
    provider: "meta",
    externalCampaignId: campaign.id,
    externalAdId: ad.id,
    creative: input.creative,
  };
}
