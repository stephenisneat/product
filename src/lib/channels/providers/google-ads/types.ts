import type { GoogleAdsChannelType } from "@/domain";

/** Advertising channel type enum values used by Google Ads API. */
export const CHANNEL_TYPES = {
  SEARCH: "SEARCH",
  DISPLAY: "DISPLAY",
  VIDEO: "VIDEO",
} as const satisfies Record<GoogleAdsChannelType, GoogleAdsChannelType>;

export const CAMPAIGN_STATUS = {
  ENABLED: "ENABLED",
  PAUSED: "PAUSED",
  REMOVED: "REMOVED",
} as const;

export type GoogleAdsCampaignStatus =
  (typeof CAMPAIGN_STATUS)[keyof typeof CAMPAIGN_STATUS];

export const BIDDING_STRATEGIES = {
  MANUAL_CPC: "MANUAL_CPC",
  MAXIMIZE_CLICKS: "MAXIMIZE_CLICKS",
  MAXIMIZE_CONVERSIONS: "MAXIMIZE_CONVERSIONS",
  TARGET_CPA: "TARGET_CPA",
  TARGET_ROAS: "TARGET_ROAS",
  TARGET_SPEND: "TARGET_SPEND",
} as const;

export type GoogleAdsBiddingStrategy =
  (typeof BIDDING_STRATEGIES)[keyof typeof BIDDING_STRATEGIES];

export type GoogleAdsAccessibleCustomer = {
  resourceName: string;
  customerId: string;
};

export type GoogleAdsCustomerDetail = {
  customerId: string;
  descriptiveName: string;
  currencyCode: string;
  timeZone: string;
  manager: boolean;
  testAccount: boolean;
};

export type GoogleAdsCampaign = {
  resourceName: string;
  id: string;
  name: string;
  status: string;
  channelType: string;
  biddingStrategyType?: string;
  campaignBudget?: string;
  startDate?: string;
  endDate?: string;
};

export type GoogleAdsAdGroup = {
  resourceName: string;
  id: string;
  name: string;
  status: string;
  campaign: string;
  type?: string;
  cpcBidMicros?: string;
};

export type GoogleAdsMutateOperation = {
  create?: Record<string, unknown>;
  update?: Record<string, unknown>;
  remove?: string;
  updateMask?: string;
};

export type GoogleAdsSearchRow = Record<string, unknown>;

export type CreateCampaignInput = {
  name: string;
  channelType: GoogleAdsChannelType;
  status?: GoogleAdsCampaignStatus;
  /** Daily budget in account currency (e.g. 50.00 for $50). */
  dailyBudget: number;
  biddingStrategy?: GoogleAdsBiddingStrategy;
  /** Target CPA in account currency when using TARGET_CPA. */
  targetCpa?: number;
  /** Target ROAS as a ratio (e.g. 3.5 = 350%). */
  targetRoas?: number;
  startDate?: string;
  endDate?: string;
  /** Network settings for Search campaigns. */
  networkSettings?: {
    targetGoogleSearch?: boolean;
    targetSearchNetwork?: boolean;
    targetContentNetwork?: boolean;
    targetPartnerSearchNetwork?: boolean;
  };
  /** YouTube / video campaign subtype when channelType is VIDEO. */
  videoCampaignSubtype?: "VIDEO_ACTION" | "VIDEO_REACH" | "VIDEO_NON_SKIPPABLE";
};
