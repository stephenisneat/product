/** Env vars required when Trigger.dev workers run job code against Supabase. */
const REQUIRED_TRIGGER_JOB_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

/**
 * Fail fast in Trigger workers when Supabase env is missing.
 * Without this, fetches to an unset/wrong URL can hang until maxDuration (often minutes).
 */
export function assertTriggerJobEnv(): void {
  const missing: string[] = REQUIRED_TRIGGER_JOB_ENV.filter(
    (key) => !process.env[key]?.trim(),
  );
  // Publishable key is also required by getSupabaseConfig().
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() &&
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  ) {
    missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  if (missing.length === 0) return;

  throw new Error(
    `Trigger job missing env: ${missing.join(", ")}. ` +
      "Set these in the Trigger.dev dashboard (Environment Variables) for this environment, then redeploy with `pnpm exec trigger deploy`.",
  );
}
