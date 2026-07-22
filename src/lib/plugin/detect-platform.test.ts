import { describe, expect, it } from "vitest";
import { detectInstallPlatform } from "@/lib/plugin/detect-platform";
import type { CommerceConnection } from "@/domain";

function connection(
  provider: CommerceConnection["provider"],
  status: CommerceConnection["status"] = "active",
): CommerceConnection {
  return {
    id: `${provider}-1`,
    workspaceId: "ws-1",
    provider,
    shopDomain: "example.com",
    scope: "",
    status,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
}

describe("detectInstallPlatform", () => {
  it("prefers an active commerce connection", () => {
    expect(
      detectInstallPlatform({
        connections: [
          connection("woocommerce", "disconnected"),
          connection("shopify", "active"),
        ],
        productProviders: ["bigcommerce", "bigcommerce"],
      }),
    ).toBe("shopify");
  });

  it("falls back to the most common product source provider", () => {
    expect(
      detectInstallPlatform({
        connections: [],
        productProviders: ["shopify", "woocommerce", "woocommerce", null],
      }),
    ).toBe("woocommerce");
  });

  it("returns null when nothing is known", () => {
    expect(
      detectInstallPlatform({
        connections: [],
        productProviders: [null, undefined],
      }),
    ).toBeNull();
  });
});
