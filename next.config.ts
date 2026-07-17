import type { NextConfig } from "next";

function supabaseImagePattern() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol.replace(":", "") as "http" | "https";
    return {
      protocol,
      hostname: parsed.hostname,
      ...(parsed.port ? { port: parsed.port } : {}),
      pathname: "/storage/v1/object/public/**",
    };
  } catch {
    return undefined;
  }
}

const supabasePattern = supabaseImagePattern();

const nextConfig: NextConfig = {
  // Avoid Turbopack scope-hoisting TDZ crashes with Zod 4 during
  // `next build` page-data collection (vercel/next.js#82723).
  experimental: {
    turbopackScopeHoisting: false,
  },
  images: {
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
      ...(supabasePattern ? [supabasePattern] : []),
    ],
  },
};

export default nextConfig;
