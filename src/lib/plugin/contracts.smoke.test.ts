/**
 * Contract smoke tests for the plugin container system.
 * Validates authoring ↔ runtime contracts without a live database.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PRODUCT_ROOT = join(__dirname, "../../..");
const PLUGIN_ROOT = join(PRODUCT_ROOT, "../product-plugin");

describe("plugin container contracts", () => {
  it("migrations define required tables, multi-plugin columns, and publish RPC", () => {
    const base = readFileSync(
      join(PRODUCT_ROOT, "supabase/migrations/028_plugin_containers.sql"),
      "utf8",
    );
    const multi = readFileSync(
      join(PRODUCT_ROOT, "supabase/migrations/045_multi_plugin_containers.sql"),
      "utf8",
    );
    for (const name of [
      "plugin_containers",
      "plugin_container_tags",
      "plugin_container_triggers",
      "plugin_container_variables",
      "plugin_container_versions",
      "plugin_measurement_events",
      "publish_plugin_container_snapshot_version",
    ]) {
      expect(base).toMatch(new RegExp(name));
    }
    expect(base).toMatch(/unique\s*\(\s*workspace_id\s*\)/i);
    expect(multi).toMatch(/drop constraint if exists plugin_containers_workspace_id_key/i);
    expect(multi).toMatch(/\bname text\b/);
    expect(multi).toMatch(/\bplatform text\b/);
    expect(multi).toMatch(/\bdomain text\b/);
    expect(multi).toMatch(/plugin_id uuid/);
  });

  it("install snippet uses data-plugin and /v1/plugin.js", () => {
    const src = readFileSync(
      join(PRODUCT_ROOT, "src/lib/plugin/install-snippet.ts"),
      "utf8",
    );
    expect(src).toMatch(/data-plugin=/);
    expect(src).toMatch(/\/v1\/plugin\.js/);
    expect(src).toMatch(/NEXT_PUBLIC_PLUGIN_URL/);
    expect(src).not.toMatch(/data-workspace=/);
  });

  it("product-plugin loader reads data-plugin and hits plugin container + ingest", () => {
    const js = readFileSync(
      join(PLUGIN_ROOT, "public/v1/plugin.js"),
      "utf8",
    );
    expect(js).toMatch(/data-plugin/);
    expect(js).toMatch(/\/api\/t\/container\/p\//);
    expect(js).toMatch(/\/api\/t\/e/);
    expect(js).toMatch(/window\.product/);
    expect(js).toMatch(/__product_optout/);
    expect(js).not.toMatch(/data-brand/);
    expect(js).not.toMatch(/data-workspace/);
    expect(js).not.toMatch(/\/api\/t\/container\/ws\//);
  });

  it("published snapshot shape matches runtime expectations", () => {
    const snapshot = {
      version: 1,
      plugin_id: "plugin-1",
      workspace_id: "ws-1",
      tags: [
        {
          id: "t1",
          name: "Pixel",
          type: "pixel",
          config: { url: "https://example.com/p.gif" },
          trigger_ids: ["tr1"],
          priority: 0,
          enabled: true,
          consent_category: "necessary",
        },
      ],
      triggers: [
        { id: "tr1", name: "All pages", type: "pageview", config: {} },
      ],
      variables: [
        {
          id: "v1",
          name: "site",
          type: "constant",
          config: { value: "demo" },
        },
      ],
    };

    expect(typeof snapshot.version).toBe("number");
    expect(typeof snapshot.plugin_id).toBe("string");
    expect(typeof snapshot.workspace_id).toBe("string");
    expect(Array.isArray(snapshot.tags)).toBe(true);
    expect(Array.isArray(snapshot.triggers)).toBe(true);
    expect(Array.isArray(snapshot.variables)).toBe(true);
    expect(snapshot.tags[0].trigger_ids).toContain("tr1");
  });

  it("settings plugin pages and API routes exist", () => {
    for (const rel of [
      "src/app/(settings)/settings/plugin/page.tsx",
      "src/app/(settings)/settings/plugin/[pluginId]/page.tsx",
      "src/app/api/plugin/containers/route.ts",
      "src/app/api/plugin/containers/[pluginId]/route.ts",
      "src/app/api/plugin/containers/[pluginId]/install-status/route.ts",
      "src/app/api/plugin/containers/[pluginId]/ping/route.ts",
      "src/features/plugin/container-manager.tsx",
      "src/features/plugin/create-plugin-dialog.tsx",
      "src/features/plugin/plugin-list.tsx",
      "src/features/plugin/install-panel.tsx",
      "src/features/plugin/product-plugin-menu.tsx",
      "src/features/plugin/install-platforms.ts",
      "src/features/plugin/snippet-highlight.tsx",
    ]) {
      expect(() =>
        readFileSync(join(PRODUCT_ROOT, rel), "utf8"),
      ).not.toThrow();
    }
  });
});
