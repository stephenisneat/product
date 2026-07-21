import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMfaAssurance } from "@/lib/auth/mfa";
import { safeNextPath } from "@/lib/auth/redirect";
import { WORKSPACE_COOKIE } from "@/lib/auth/workspace";

const MFA_EXEMPT_EXACT = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/update-password",
  "/privacy",
  "/terms",
  "/pricing",
]);

const MFA_EXEMPT_PREFIXES = ["/auth/", "/invite/", "/api/auth/"];

const MFA_ENROLL_ALLOWLIST = new Set(["/settings/security"]);

export function isMfaExemptPath(pathname: string): boolean {
  if (MFA_EXEMPT_EXACT.has(pathname)) return true;
  return MFA_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isMfaEnrollAllowlisted(pathname: string): boolean {
  return (
    MFA_ENROLL_ALLOWLIST.has(pathname) ||
    pathname.startsWith("/settings/security/")
  );
}

function wantsJson(request: NextRequest) {
  const accept = request.headers.get("accept") ?? "";
  const contentType = request.headers.get("content-type") ?? "";
  return (
    request.nextUrl.pathname.startsWith("/api/") ||
    accept.includes("application/json") ||
    contentType.includes("application/json")
  );
}

function mfaRedirect(
  request: NextRequest,
  targetPath: string,
  reason: "challenge" | "enroll",
) {
  const next = safeNextPath(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  const url = request.nextUrl.clone();
  url.pathname = targetPath;
  url.search = "";
  url.searchParams.set("next", next);
  if (reason === "enroll") {
    url.searchParams.set("required", "1");
  }

  if (wantsJson(request)) {
    return NextResponse.json(
      {
        error:
          reason === "challenge"
            ? "Two-factor authentication required"
            : "Two-factor authentication must be enabled for this workspace",
        code: reason === "challenge" ? "MFA_CHALLENGE" : "MFA_ENROLL",
        redirectTo: `${url.pathname}${url.search}`,
      },
      { status: 403 },
    );
  }

  return NextResponse.redirect(url);
}

async function activeWorkspaceRequiresMfa(
  supabase: SupabaseClient,
  request: NextRequest,
  userId: string,
): Promise<boolean> {
  const cookieId = request.cookies.get(WORKSPACE_COOKIE)?.value;

  let workspaceId = cookieId ?? null;
  if (!workspaceId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_workspace_id")
      .eq("id", userId)
      .maybeSingle();
    workspaceId =
      (profile?.active_workspace_id as string | null | undefined) ?? null;
  }

  if (!workspaceId) return false;

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) return false;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("require_mfa")
    .eq("id", workspaceId)
    .maybeSingle();

  return Boolean(workspace?.require_mfa);
}

export async function enforceMfaGate(
  request: NextRequest,
  supabase: SupabaseClient,
  userId: string,
): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;
  if (isMfaExemptPath(pathname)) {
    return null;
  }

  // AAL only — skip listFactors on every soft nav. Challenge and "has a
  // verified factor" both follow from current/next assurance levels.
  const assurance = await getMfaAssurance(supabase);

  if (assurance.needsChallenge) {
    return mfaRedirect(request, "/auth/mfa", "challenge");
  }

  if (isMfaEnrollAllowlisted(pathname)) {
    return null;
  }

  // Already enrolled (aal2 possible or active) → enroll gate does not apply.
  if (assurance.hasVerifiedFactor) {
    return null;
  }

  const requires = await activeWorkspaceRequiresMfa(
    supabase,
    request,
    userId,
  );
  if (requires) {
    return mfaRedirect(request, "/settings/security", "enroll");
  }

  return null;
}
