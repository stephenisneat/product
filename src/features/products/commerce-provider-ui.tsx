import type { CommerceProviderUiConfig } from "@/features/products/import-commerce-dialog";

export const WOOCOMMERCE_UI: CommerceProviderUiConfig = {
  provider: "woocommerce",
  title: "Import from WooCommerce",
  description:
    "Connect with your store URL and REST API keys, then choose which products to import.",
  configuredKey: "woocommerceConfigured",
  queryParam: "woocommerce",
  connectMode: "credentials",
  connectPath: "/api/integrations/woocommerce/connect",
  productsPath: "/api/integrations/woocommerce/products",
  importPath: "/api/integrations/woocommerce/import",
  shopFieldLabel: "Store URL",
  shopFieldPlaceholder: "https://shop.example.com",
  connectHint:
    "Create a Read-only REST API key in WooCommerce → Settings → Advanced → REST API.",
  connectButtonLabel: "Connect WooCommerce",
  notConfiguredHint: (
    <>
      WooCommerce is not configured for this environment. Add{" "}
      <span className="font-mono text-xs">TOKEN_ENCRYPTION_KEY</span> (or another
      commerce secret) and{" "}
      <span className="font-mono text-xs">NEXT_PUBLIC_APP_URL</span>.
    </>
  ),
  extraFields: [
    {
      id: "consumerKey",
      label: "Consumer key",
      placeholder: "ck_…",
    },
    {
      id: "consumerSecret",
      label: "Consumer secret",
      placeholder: "cs_…",
      type: "password",
    },
  ],
  buildConnectBody: (values) => ({
    storeUrl: values.shop ?? "",
    consumerKey: values.consumerKey ?? "",
    consumerSecret: values.consumerSecret ?? "",
  }),
};

export const BIGCOMMERCE_UI: CommerceProviderUiConfig = {
  provider: "bigcommerce",
  title: "Import from BigCommerce",
  description:
    "Connect your store with OAuth, then choose which products to import.",
  configuredKey: "bigcommerceConfigured",
  queryParam: "bigcommerce",
  connectMode: "oauth",
  installPath: "/api/integrations/bigcommerce/install",
  productsPath: "/api/integrations/bigcommerce/products",
  importPath: "/api/integrations/bigcommerce/import",
  shopFieldLabel: "Store hash",
  shopFieldPlaceholder: "abc123xyz",
  connectHint:
    "You will be redirected to BigCommerce to authorize the Product Agent app.",
  connectButtonLabel: "Connect BigCommerce",
  notConfiguredHint: (
    <>
      BigCommerce is not configured for this environment. Add{" "}
      <span className="font-mono text-xs">BIGCOMMERCE_CLIENT_ID</span>,{" "}
      <span className="font-mono text-xs">BIGCOMMERCE_CLIENT_SECRET</span>, and{" "}
      <span className="font-mono text-xs">NEXT_PUBLIC_APP_URL</span>.
    </>
  ),
};

export const AMAZON_UI: CommerceProviderUiConfig = {
  provider: "amazon",
  title: "Import from Amazon",
  description:
    "Authorize Selling Partner API access, then choose which listings to import.",
  configuredKey: "amazonConfigured",
  queryParam: "amazon",
  connectMode: "oauth",
  installPath: "/api/integrations/amazon/install",
  productsPath: "/api/integrations/amazon/products",
  importPath: "/api/integrations/amazon/import",
  shopFieldLabel: "Marketplace ID",
  shopFieldPlaceholder: "ATVPDKIKX0DER",
  connectHint:
    "You will be redirected to Amazon Seller Central to authorize the app. US marketplace ID defaults to ATVPDKIKX0DER.",
  connectButtonLabel: "Connect Amazon",
  notConfiguredHint: (
    <>
      Amazon is not configured for this environment. Add{" "}
      <span className="font-mono text-xs">AMAZON_LWA_CLIENT_ID</span>,{" "}
      <span className="font-mono text-xs">AMAZON_LWA_CLIENT_SECRET</span>,{" "}
      <span className="font-mono text-xs">AMAZON_SP_API_APP_ID</span>, and{" "}
      <span className="font-mono text-xs">NEXT_PUBLIC_APP_URL</span>.
    </>
  ),
  extraFields: [
    {
      id: "sellerId",
      label: "Seller ID",
      placeholder: "A1EXAMPLEID",
    },
  ],
  buildInstallQuery: (values) =>
    `sellerId=${encodeURIComponent((values.sellerId ?? "").trim())}`,
};

export const SQUARESPACE_UI: CommerceProviderUiConfig = {
  provider: "squarespace",
  title: "Import from Squarespace",
  description:
    "Connect your site with OAuth, then choose which products to import.",
  configuredKey: "squarespaceConfigured",
  queryParam: "squarespace",
  connectMode: "oauth",
  installPath: "/api/integrations/squarespace/install",
  productsPath: "/api/integrations/squarespace/products",
  importPath: "/api/integrations/squarespace/import",
  shopFieldLabel: "Site ID or domain",
  shopFieldPlaceholder: "example.com",
  connectHint:
    "You will be redirected to Squarespace to authorize the Product Agent app.",
  connectButtonLabel: "Connect Squarespace",
  notConfiguredHint: (
    <>
      Squarespace is not configured for this environment. Add{" "}
      <span className="font-mono text-xs">SQUARESPACE_CLIENT_ID</span>,{" "}
      <span className="font-mono text-xs">SQUARESPACE_CLIENT_SECRET</span>, and{" "}
      <span className="font-mono text-xs">NEXT_PUBLIC_APP_URL</span>.
    </>
  ),
};
