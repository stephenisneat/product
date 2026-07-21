import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

function supabaseImageHost() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return undefined;
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}

function supabaseImagePattern() {
  const parsed = supabaseImageHost();
  if (!parsed) return undefined;
  const protocol = parsed.protocol.replace(":", "") as "http" | "https";
  return {
    protocol,
    hostname: parsed.hostname,
    ...(parsed.port ? { port: parsed.port } : {}),
    pathname: "/storage/v1/object/public/**",
  };
}

function isLocalSupabaseHost() {
  const hostname = supabaseImageHost()?.hostname;
  return (
    hostname === "127.0.0.1" ||
    hostname === "localhost" ||
    hostname === "[::1]"
  );
}

const supabasePattern = supabaseImagePattern();

const nextConfig: NextConfig = {
  devIndicators: false,
  // Avoid Turbopack scope-hoisting TDZ crashes with Zod 4 during
  // `next build` page-data collection (vercel/next.js#82723).
  experimental: {
    turbopackScopeHoisting: false,
  },
  // Remotion renderer/bundler are Node-only (used by creative video jobs).
  serverExternalPackages: [
    "@remotion/bundler",
    "@remotion/renderer",
    "@remotion/compositor-darwin-arm64",
    "@remotion/compositor-darwin-x64",
    "@remotion/compositor-linux-arm64-gnu",
    "@remotion/compositor-linux-arm64-musl",
    "@remotion/compositor-linux-x64-gnu",
    "@remotion/compositor-linux-x64-musl",
    "@remotion/compositor-win32-x64-msvc",
  ],
  images: {
    // Next.js 16 blocks private IPs by default; local Supabase storage needs this.
    dangerouslyAllowLocalIP: isLocalSupabaseHost(),
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.shopifycdn.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn11.bigcommerce.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.squarespace-cdn.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "static.squarespace.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "m.media-amazon.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images-na.ssl-images-amazon.com",
        pathname: "/**",
      },
      ...(supabasePattern ? [supabasePattern] : []),
    ],
  },
};

export default withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
})(nextConfig);
