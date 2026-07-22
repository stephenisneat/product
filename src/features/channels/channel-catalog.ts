export type ChannelLogoVariant = "default" | "mono" | "color";

export type ChannelCatalogEntry = {
  id: string;
  name: string;
  /** Short subtitle shown under the channel name in the menu. */
  description: string;
  /**
   * thesvg.org icon slug (`https://thesvg.org/icons/{slug}/{variant}.svg`).
   * `null` when no suitable brand mark exists — UI shows a letter fallback.
   */
  logoSlug: string | null;
  /** Prefer square/color marks for the 20px menu; defaults to `default`. */
  logoVariant?: ChannelLogoVariant;
  /** Company / product homepage opened when the logo is clicked. */
  websiteUrl: string;
};

/** Channels with a real connect flow in the product today. */
export const LIVE_CHANNELS: ChannelCatalogEntry[] = [
  {
    id: "google",
    name: "Google Ads",
    description: "Search, Display & YouTube",
    logoSlug: "google-ads",
    websiteUrl: "https://ads.google.com",
  },
  {
    id: "meta",
    name: "Meta Ads",
    description: "Facebook & Instagram",
    logoSlug: "meta",
    logoVariant: "color",
    websiteUrl: "https://www.meta.com",
  },
  {
    id: "tiktok",
    name: "TikTok Ads",
    description: "In-Feed & TopView",
    logoSlug: "tiktok",
    logoVariant: "mono",
    websiteUrl: "https://www.tiktok.com/business",
  },
  {
    id: "amazon",
    name: "Amazon Ads",
    description: "Sponsored Products, Brands & Display",
    // thesvg only ships the wide wordmark; still better than a letter.
    logoSlug: "amazon",
    websiteUrl: "https://advertising.amazon.com",
  },
  {
    id: "x",
    name: "X Ads",
    description: "Promoted posts & ads",
    logoSlug: "x",
    websiteUrl: "https://ads.x.com",
  },
];

/**
 * Temporary aspirational list — ad channels, retail media, and traditional SSPs.
 * Not connectable yet; shown under “Coming soon” in the channels menu.
 */
export const COMING_SOON_CHANNELS: ChannelCatalogEntry[] = [
  // Ad channels & retail media
  {
    id: "pinterest",
    name: "Pinterest Ads",
    description: "Shopping & idea pins",
    logoSlug: "pinterest",
    websiteUrl: "https://ads.pinterest.com",
  },
  {
    id: "microsoft-ads",
    name: "Microsoft Advertising",
    description: "Bing & partner search",
    logoSlug: "microsoft-bing",
    logoVariant: "color",
    websiteUrl: "https://ads.microsoft.com",
  },
  {
    id: "snapchat",
    name: "Snapchat Ads",
    description: "Stories & Spotlight",
    logoSlug: "snapchat",
    logoVariant: "mono",
    websiteUrl: "https://forbusiness.snapchat.com",
  },
  {
    id: "linkedin",
    name: "LinkedIn Ads",
    description: "B2B & professional",
    logoSlug: "linkedin",
    websiteUrl: "https://business.linkedin.com/marketing-solutions/ads",
  },
  {
    id: "reddit",
    name: "Reddit Ads",
    description: "Communities & conversations",
    logoSlug: "reddit",
    websiteUrl: "https://ads.reddit.com",
  },
  {
    id: "apple-search",
    name: "Apple Search Ads",
    description: "App Store search",
    logoSlug: "apple",
    logoVariant: "mono",
    websiteUrl: "https://ads.apple.com",
  },
  {
    id: "spotify",
    name: "Spotify Ads",
    description: "Audio & podcasts",
    logoSlug: "spotify",
    websiteUrl: "https://ads.spotify.com",
  },
  {
    id: "walmart",
    name: "Walmart Connect",
    description: "Retail media network",
    logoSlug: "walmart",
    logoVariant: "mono",
    websiteUrl: "https://www.walmartconnect.com",
  },
  {
    id: "target",
    name: "Target Roundel",
    description: "Retail media network",
    logoSlug: "target",
    websiteUrl: "https://roundel.target.com",
  },
  {
    id: "instacart",
    name: "Instacart Ads",
    description: "Grocery retail media",
    logoSlug: "instacart",
    websiteUrl: "https://www.instacart.com/company/ads",
  },
  {
    id: "criteo",
    name: "Criteo",
    description: "Retail media & commerce",
    logoSlug: null,
    websiteUrl: "https://www.criteo.com",
  },
  {
    id: "thetradedesk",
    name: "The Trade Desk",
    description: "Programmatic DSP",
    logoSlug: null,
    websiteUrl: "https://www.thetradedesk.com",
  },
  {
    id: "dv360",
    name: "DV360",
    description: "Google Display & Video 360",
    logoSlug: "google-display-video-360",
    websiteUrl:
      "https://marketingplatform.google.com/about/display-video-360",
  },
  {
    id: "taboola",
    name: "Taboola",
    description: "Native discovery",
    logoSlug: "taboola",
    websiteUrl: "https://www.taboola.com",
  },
  {
    id: "outbrain",
    name: "Outbrain",
    description: "Native discovery",
    logoSlug: null,
    websiteUrl: "https://www.outbrain.com",
  },
  {
    id: "kroger",
    name: "Kroger Precision Marketing",
    description: "Grocery retail media",
    logoSlug: "kroger",
    websiteUrl: "https://www.krogerprecisionmarketing.com",
  },
  {
    id: "bestbuy",
    name: "Best Buy Ads",
    description: "Retail media network",
    logoSlug: "best-buy",
    websiteUrl: "https://www.bestbuyads.com",
  },
  // Traditional SSPs
  {
    id: "gam",
    name: "Google Ad Manager",
    description: "Publisher ad server",
    // No dedicated GAM mark in thesvg; Google color mark is closest.
    logoSlug: "google",
    logoVariant: "color",
    websiteUrl: "https://admanager.google.com",
  },
  {
    id: "magnite",
    name: "Magnite",
    description: "Supply-side platform",
    logoSlug: null,
    websiteUrl: "https://www.magnite.com",
  },
  {
    id: "pubmatic",
    name: "PubMatic",
    description: "Supply-side platform",
    logoSlug: null,
    websiteUrl: "https://pubmatic.com",
  },
  {
    id: "index-exchange",
    name: "Index Exchange",
    description: "Supply-side platform",
    logoSlug: null,
    websiteUrl: "https://www.indexexchange.com",
  },
  {
    id: "openx",
    name: "OpenX",
    description: "Supply-side platform",
    logoSlug: null,
    websiteUrl: "https://www.openx.com",
  },
  {
    id: "equativ",
    name: "Equativ",
    description: "Supply-side platform",
    logoSlug: null,
    websiteUrl: "https://equativ.com",
  },
  {
    id: "sharethrough",
    name: "Sharethrough",
    description: "Supply-side platform",
    logoSlug: null,
    websiteUrl: "https://www.sharethrough.com",
  },
  {
    id: "xandr",
    name: "Xandr",
    description: "Microsoft SSP & DSP",
    logoSlug: "microsoft",
    logoVariant: "color",
    websiteUrl: "https://www.microsoft.com/en-us/advertising",
  },
  {
    id: "yahoo-ad-tech",
    name: "Yahoo Ad Tech",
    description: "Supply-side platform",
    logoSlug: null,
    websiteUrl: "https://www.yahooinc.com/advertising",
  },
  {
    id: "sovrn",
    name: "Sovrn",
    description: "Supply-side platform",
    logoSlug: null,
    websiteUrl: "https://www.sovrn.com",
  },
  {
    id: "triplelift",
    name: "TripleLift",
    description: "Native & video SSP",
    logoSlug: null,
    websiteUrl: "https://triplelift.com",
  },
  {
    id: "medianet",
    name: "Media.net",
    description: "Contextual advertising",
    logoSlug: null,
    websiteUrl: "https://www.media.net",
  },
];

export function channelLogoUrl(
  logoSlug: string,
  variant: ChannelLogoVariant = "default",
): string {
  return `https://thesvg.org/icons/${encodeURIComponent(logoSlug)}/${encodeURIComponent(variant)}.svg`;
}
