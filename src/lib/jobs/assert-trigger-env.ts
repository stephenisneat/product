/** Env vars required when Trigger.dev workers run job code against Supabase. */
const REQUIRED_TRIGGER_JOB_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

/**
 * Validate the Supabase URL shape used by Trigger workers.
 * A missing/malformed host makes Kong return the opaque "Project not specified."
 */
export function assertSupabaseUrlForTrigger(url: string): void {
  const trimmed = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(
      `Trigger job NEXT_PUBLIC_SUPABASE_URL is not a valid URL ("${trimmed}"). ` +
        "Use the Project URL from Supabase → Settings → API " +
        "(e.g. https://<project-ref>.supabase.co), set it in the Trigger.dev " +
        "dashboard Environment Variables for this environment.",
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `Trigger job NEXT_PUBLIC_SUPABASE_URL must be http(s) ("${trimmed}").`,
    );
  }

  const host = parsed.hostname.toLowerCase();
  // Common copy/paste mistakes that produce Kong's "Project not specified."
  if (
    host === "supabase.co" ||
    host === "www.supabase.co" ||
    host === "supabase.com" ||
    host === "www.supabase.com" ||
    host === "api.supabase.com" ||
    host === "api.supabase.co"
  ) {
    throw new Error(
      `Trigger job NEXT_PUBLIC_SUPABASE_URL host "${host}" is not a project URL. ` +
        "Use https://<project-ref>.supabase.co from Supabase → Settings → API.",
    );
  }

  // Project ref alone (no scheme/host) is already rejected by URL(); also
  // reject bare "*.supabase.co" without a subdomain.
  if (host === "supabase.co" || host.endsWith(".supabase.co")) {
    const subdomain = host.replace(/\.supabase\.co$/, "");
    if (!subdomain || subdomain === "www") {
      throw new Error(
        `Trigger job NEXT_PUBLIC_SUPABASE_URL is missing the project ref subdomain ("${trimmed}").`,
      );
    }
  }
}

/**
 * Fail fast in Trigger workers when Supabase env is missing or malformed.
 * Without this, fetches to an unset/wrong URL can hang until maxDuration, or
 * fail with Supabase's opaque "Project not specified."
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

  if (missing.length > 0) {
    throw new Error(
      `Trigger job missing env: ${missing.join(", ")}. ` +
        "Set these in the Trigger.dev dashboard (Environment Variables) for this environment, then redeploy with `pnpm exec trigger deploy`.",
    );
  }

  assertSupabaseUrlForTrigger(process.env.NEXT_PUBLIC_SUPABASE_URL!);
}

/** Rewrite opaque Supabase gateway errors into actionable Trigger env guidance. */
export function clarifyTriggerSupabaseError(message: string): string {
  if (!/project not specified/i.test(message)) return message;
  return (
    'Supabase returned "Project not specified." — the Trigger worker ' +
    "NEXT_PUBLIC_SUPABASE_URL is set but does not resolve to your project. " +
    "In Trigger.dev → Environment Variables, set it to the same Project URL as Vercel " +
    "(Supabase → Settings → API → Project URL, e.g. https://<project-ref>.supabase.co), " +
    "not localhost and not supabase.com. Then retry the job."
  );
}
