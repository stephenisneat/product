import { additionalPackages } from "@trigger.dev/build/extensions/core";
import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  // Set via `npx trigger.dev@latest init` or the Trigger.dev dashboard project settings.
  project: process.env.TRIGGER_PROJECT_ID ?? "proj_dxojajjvvmteroaoalvt",
  // pnpm@11 requires Node >=22; default "node" is 21.x / build image 20.x
  runtime: "node-22",
  logLevel: "log",
  maxDuration: 1200,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10_000,
      factor: 2,
    },
  },
  dirs: ["./src/trigger"],
  build: {
    // Auto-detect on macOS pins @rspack/binding-darwin-arm64 as a hard dep,
    // which breaks the Linux worker image install (EBADPLATFORM).
    autoDetectExternal: false,
    external: [
      "@remotion/bundler",
      "@remotion/renderer",
      "@rspack/binding",
      "import-in-the-middle",
    ],
    extensions: [
      additionalPackages({
        packages: [
          "@rspack/binding@1.7.11",
          "@rspack/binding-linux-x64-gnu@1.7.11",
          "@remotion/compositor-linux-x64-gnu@4.0.494",
        ],
      }),
    ],
  },
});
