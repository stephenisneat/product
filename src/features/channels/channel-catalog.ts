export type ChannelCatalogEntry = {
  id: string;
  name: string;
  /** Short subtitle shown under the channel name in the menu. */
  description: string;
  /** Simple Icons slug for `https://cdn.simpleicons.org/{slug}` */
  logoSlug: string;
  /** Company / product homepage opened when the logo is clicked. */
  websiteUrl: string;
};

/** Channels with a real connect flow in the product today. */
export const LIVE_CHANNELS: ChannelCatalogEntry[] = [
  {
    id: "google",
    name: "Google Ads",
    description: "Search, Display & YouTube",
    logoSlug: "googleads",
    websiteUrl: "https://ads.google.com",
  },
  {
    id: "meta",
    name: "Meta Ads",
    description: "Facebook & Instagram",
    logoSlug: "meta",
    websiteUrl: "https://www.meta.com",
  },
  {
    id: "tiktok",
    name: "TikTok Ads",
    description: "In-Feed & TopView",
    logoSlug: "tiktok",
    websiteUrl: "https://www.tiktok.com/business",
  },
  {
    id: "amazon",
    name: "Amazon Ads",
    description: "Sponsored Products, Brands & Display",
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
  { id: "pinterest", name: "Pinterest Ads", description: "Shopping & idea pins", logoSlug: "pinterest", websiteUrl: "https://ads.pinterest.com" },
  { id: "microsoft-ads", name: "Microsoft Advertising", description: "Bing & partner search", logoSlug: "microsoftadvertising", websiteUrl: "https://ads.microsoft.com" },
  { id: "snapchat", name: "Snapchat Ads", description: "Stories & Spotlight", logoSlug: "snapchat", websiteUrl: "https://forbusiness.snapchat.com" },
  { id: "linkedin", name: "LinkedIn Ads", description: "B2B & professional", logoSlug: "linkedin", websiteUrl: "https://business.linkedin.com/marketing-solutions/ads" },
  { id: "reddit", name: "Reddit Ads", description: "Communities & conversations", logoSlug: "reddit", websiteUrl: "https://ads.reddit.com" },
  { id: "apple-search", name: "Apple Search Ads", description: "App Store search", logoSlug: "apple", websiteUrl: "https://ads.apple.com" },
  { id: "spotify", name: "Spotify Ads", description: "Audio & podcasts", logoSlug: "spotify", websiteUrl: "https://ads.spotify.com" },
  { id: "walmart", name: "Walmart Connect", description: "Retail media network", logoSlug: "walmart", websiteUrl: "https://www.walmartconnect.com" },
  { id: "target", name: "Target Roundel", description: "Retail media network", logoSlug: "target", websiteUrl: "https://roundel.target.com" },
  { id: "instacart", name: "Instacart Ads", description: "Grocery retail media", logoSlug: "instacart", websiteUrl: "https://www.instacart.com/company/ads" },
  { id: "criteo", name: "Criteo", description: "Retail media & commerce", logoSlug: "criteo", websiteUrl: "https://www.criteo.com" },
  { id: "thetradedesk", name: "The Trade Desk", description: "Programmatic DSP", logoSlug: "thetradedesk", websiteUrl: "https://www.thetradedesk.com" },
  { id: "dv360", name: "DV360", description: "Google Display & Video 360", logoSlug: "googledisplayandvideo360", websiteUrl: "https://marketingplatform.google.com/about/display-video-360" },
  { id: "taboola", name: "Taboola", description: "Native discovery", logoSlug: "taboola", websiteUrl: "https://www.taboola.com" },
  { id: "outbrain", name: "Outbrain", description: "Native discovery", logoSlug: "outbrain", websiteUrl: "https://www.outbrain.com" },
  { id: "kroger", name: "Kroger Precision Marketing", description: "Grocery retail media", logoSlug: "kroger", websiteUrl: "https://www.krogerprecisionmarketing.com" },
  { id: "bestbuy", name: "Best Buy Ads", description: "Retail media network", logoSlug: "bestbuy", websiteUrl: "https://www.bestbuyads.com" },
  // Traditional SSPs
  { id: "gam", name: "Google Ad Manager", description: "Publisher ad server", logoSlug: "googleadmanager", websiteUrl: "https://admanager.google.com" },
  { id: "magnite", name: "Magnite", description: "Supply-side platform", logoSlug: "magnite", websiteUrl: "https://www.magnite.com" },
  { id: "pubmatic", name: "PubMatic", description: "Supply-side platform", logoSlug: "pubmatic", websiteUrl: "https://pubmatic.com" },
  { id: "index-exchange", name: "Index Exchange", description: "Supply-side platform", logoSlug: "indexexchange", websiteUrl: "https://www.indexexchange.com" },
  { id: "openx", name: "OpenX", description: "Supply-side platform", logoSlug: "openx", websiteUrl: "https://www.openx.com" },
  { id: "equativ", name: "Equativ", description: "Supply-side platform", logoSlug: "equativ", websiteUrl: "https://equativ.com" },
  { id: "sharethrough", name: "Sharethrough", description: "Supply-side platform", logoSlug: "sharethrough", websiteUrl: "https://www.sharethrough.com" },
  { id: "xandr", name: "Xandr", description: "Microsoft SSP & DSP", logoSlug: "xandr", websiteUrl: "https://www.microsoft.com/en-us/advertising" },
  { id: "yahoo-ad-tech", name: "Yahoo Ad Tech", description: "Supply-side platform", logoSlug: "yahoo", websiteUrl: "https://www.yahooinc.com/advertising" },
  { id: "sovrn", name: "Sovrn", description: "Supply-side platform", logoSlug: "sovrn", websiteUrl: "https://www.sovrn.com" },
  { id: "triplelift", name: "TripleLift", description: "Native & video SSP", logoSlug: "triplelift", websiteUrl: "https://triplelift.com" },
  { id: "medianet", name: "Media.net", description: "Contextual advertising", logoSlug: "medianet", websiteUrl: "https://www.media.net" },
];

export function channelLogoUrl(logoSlug: string): string {
  return `https://cdn.simpleicons.org/${encodeURIComponent(logoSlug)}`;
}
