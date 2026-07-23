import type { PluginPlatform } from "@/lib/plugin/types";

export type PluginInstallPlatform = PluginPlatform;

export const PLUGIN_INSTALL_PLATFORMS: {
  value: PluginInstallPlatform;
  label: string;
}[] = [
  { value: "nextjs", label: "Next.js" },
  { value: "shopify", label: "Shopify" },
  { value: "bigcommerce", label: "BigCommerce" },
  { value: "woocommerce", label: "WooCommerce" },
  { value: "squarespace", label: "Squarespace" },
  { value: "amazon", label: "Amazon" },
  { value: "ios", label: "iOS" },
  { value: "android", label: "Android" },
  { value: "custom", label: "Custom HTML" },
];

export function platformLabel(platform: string | null | undefined): string {
  if (!platform) return "Custom HTML";
  return (
    PLUGIN_INSTALL_PLATFORMS.find((p) => p.value === platform)?.label ?? platform
  );
}

export function installInstructionsFor(
  platform: PluginInstallPlatform,
): string {
  switch (platform) {
    case "nextjs":
      return "Add the snippet to your root layout (app/layout.tsx) via next/script, or paste it into the document <head> on every page.";
    case "shopify":
      return "In Shopify admin: Online Store → Themes → … → Edit code. Open theme.liquid and paste the snippet inside the <head> tag, then save.";
    case "bigcommerce":
      return "In BigCommerce: Storefront → Script Manager → Create a Script. Set location to Head, paste the snippet, and save.";
    case "woocommerce":
      return "In WordPress: Appearance → Theme File Editor → header.php, or use an “Insert Headers and Footers” plugin. Paste the snippet in the site <head> and save.";
    case "squarespace":
      return "In Squarespace: Settings → Advanced → Code Injection. Paste the snippet into the Header field and save.";
    case "amazon":
      return "Amazon storefronts don’t support a site-wide script install. Use Custom HTML on your own product site, or paste the snippet wherever you control the page <head>.";
    case "ios":
      return "Load the snippet in a WKWebView (or inject it into your in-app browser). Native SDK install is coming later — use a WebView surface for now.";
    case "android":
      return "Load the snippet in a WebView (or inject it into your in-app browser). Native SDK install is coming later — use a WebView surface for now.";
    case "custom":
      return "Paste the snippet in the <head> of every page on your site (or your tag manager / CDN edge). One install covers all tags configured for this plugin.";
  }
}

export function isPluginInstallPlatform(
  value: string,
): value is PluginInstallPlatform {
  return PLUGIN_INSTALL_PLATFORMS.some((p) => p.value === value);
}
