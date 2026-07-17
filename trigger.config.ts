import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  // Set via `npx trigger.dev@latest init` or the Trigger.dev dashboard project settings.
  project: process.env.TRIGGER_PROJECT_ID ?? "proj_product_agent",
  runtime: "node",
  logLevel: "log",
  maxDuration: 300,
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
});
