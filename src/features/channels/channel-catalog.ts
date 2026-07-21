export type ChannelCatalogEntry = {
  id: string;
  name: string;
  /** Simple Icons slug for `https://cdn.simpleicons.org/{slug}` */
  logoSlug: string;
};

/** Channels with a real connect flow in the product today. */
export const LIVE_CHANNELS: ChannelCatalogEntry[] = [
  { id: "google", name: "Google Ads", logoSlug: "googleads" },
];

/**
 * Temporary aspirational list — ad channels, retail media, and traditional SSPs.
 * Not connectable yet; shown under “Coming soon” in the channels menu.
 */
export const COMING_SOON_CHANNELS: ChannelCatalogEntry[] = [
  // Ad channels & retail media
  { id: "meta", name: "Meta Ads", logoSlug: "meta" },
  { id: "tiktok", name: "TikTok Ads", logoSlug: "tiktok" },
  { id: "pinterest", name: "Pinterest Ads", logoSlug: "pinterest" },
  { id: "amazon-ads", name: "Amazon Ads", logoSlug: "amazon" },
  { id: "microsoft-ads", name: "Microsoft Advertising", logoSlug: "microsoftadvertising" },
  { id: "snapchat", name: "Snapchat Ads", logoSlug: "snapchat" },
  { id: "linkedin", name: "LinkedIn Ads", logoSlug: "linkedin" },
  { id: "x-ads", name: "X Ads", logoSlug: "x" },
  { id: "reddit", name: "Reddit Ads", logoSlug: "reddit" },
  { id: "apple-search", name: "Apple Search Ads", logoSlug: "apple" },
  { id: "spotify", name: "Spotify Ads", logoSlug: "spotify" },
  { id: "walmart", name: "Walmart Connect", logoSlug: "walmart" },
  { id: "target", name: "Target Roundel", logoSlug: "target" },
  { id: "instacart", name: "Instacart Ads", logoSlug: "instacart" },
  { id: "criteo", name: "Criteo", logoSlug: "criteo" },
  { id: "thetradedesk", name: "The Trade Desk", logoSlug: "thetradedesk" },
  { id: "dv360", name: "DV360", logoSlug: "googledisplayandvideo360" },
  { id: "taboola", name: "Taboola", logoSlug: "taboola" },
  { id: "outbrain", name: "Outbrain", logoSlug: "outbrain" },
  { id: "kroger", name: "Kroger Precision Marketing", logoSlug: "kroger" },
  { id: "bestbuy", name: "Best Buy Ads", logoSlug: "bestbuy" },
  // Traditional SSPs
  { id: "gam", name: "Google Ad Manager", logoSlug: "googleadmanager" },
  { id: "magnite", name: "Magnite", logoSlug: "magnite" },
  { id: "pubmatic", name: "PubMatic", logoSlug: "pubmatic" },
  { id: "index-exchange", name: "Index Exchange", logoSlug: "indexexchange" },
  { id: "openx", name: "OpenX", logoSlug: "openx" },
  { id: "equativ", name: "Equativ", logoSlug: "equativ" },
  { id: "sharethrough", name: "Sharethrough", logoSlug: "sharethrough" },
  { id: "xandr", name: "Xandr", logoSlug: "xandr" },
  { id: "yahoo-ad-tech", name: "Yahoo Ad Tech", logoSlug: "yahoo" },
  { id: "sovrn", name: "Sovrn", logoSlug: "sovrn" },
  { id: "triplelift", name: "TripleLift", logoSlug: "triplelift" },
  { id: "medianet", name: "Media.net", logoSlug: "medianet" },
];

export function channelLogoUrl(logoSlug: string): string {
  return `https://cdn.simpleicons.org/${encodeURIComponent(logoSlug)}`;
}
