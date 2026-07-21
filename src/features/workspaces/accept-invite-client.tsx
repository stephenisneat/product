"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function AcceptInviteClient({
  token,
  workspaceName,
  inviteEmail,
  role,
  userEmail,
}: {
  token: string;
  workspaceName: string;
  inviteEmail: string;
  role: string;
  userEmail: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailMismatch =
    inviteEmail.toLowerCase() !== userEmail.toLowerCase();

  async function accept() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/workspaces/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        redirectTo?: string;
      };
      if (!res.ok) {
        if (body.redirectTo) {
          router.push(body.redirectTo);
          return;
        }
        throw new Error(body.error || "Failed to accept invite");
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invite");
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="font-heading text-xl font-semibold tracking-tight">
        Join {workspaceName}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You&apos;ve been invited as <strong>{role}</strong>.
      </p>

      {emailMismatch ? (
        <p className="mt-4 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          This invite was sent to{" "}
          <span className="font-medium text-foreground">{inviteEmail}</span>, but
          you&apos;re signed in as{" "}
          <span className="font-medium text-foreground">{userEmail}</span>. Switch
          accounts to accept.
        </p>
      ) : (
        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" onClick={() => void accept()} disabled={loading}>
            {loading ? "Joining…" : "Accept invite"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/")}>
            Cancel
          </Button>
        </div>
      )}

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
