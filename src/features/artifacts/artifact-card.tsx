"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Artifact } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ArtifactCard({ artifact }: { artifact: Artifact }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [payloadJson, setPayloadJson] = useState(
    JSON.stringify(artifact.payload, null, 2),
  );
  const [error, setError] = useState<string | null>(null);

  async function mutate(action: "approve" | "reject" | "update") {
    setError(null);
    let payload = artifact.payload;
    if (action === "update" || (action === "approve" && editing)) {
      try {
        payload = JSON.parse(payloadJson) as Record<string, unknown>;
      } catch {
        setError("Payload must be valid JSON");
        return;
      }
    }

    const res = await fetch(`/api/artifacts/${artifact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Request failed");
      return;
    }

    setEditing(false);
    startTransition(() => router.refresh());
  }

  return (
    <article className="rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">{artifact.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{artifact.summary}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Badge variant="outline" className="text-[10px] uppercase">
            {artifact.type.replace("_", " ")}
          </Badge>
          <Badge
            variant={artifact.status === "approved" ? "default" : "outline"}
            className="text-[10px] uppercase"
          >
            {artifact.status}
          </Badge>
        </div>
      </div>

      {editing ? (
        <Textarea
          className="mt-3 font-mono text-xs"
          rows={10}
          value={payloadJson}
          onChange={(e) => setPayloadJson(e.target.value)}
        />
      ) : (
        <pre className="mt-3 max-h-48 overflow-auto rounded-md bg-muted/50 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {JSON.stringify(artifact.payload, null, 2)}
        </pre>
      )}

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

      {artifact.status === "proposed" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={pending}
            onClick={() => void mutate("approve")}
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => void mutate("reject")}
          >
            Reject
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Cancel edit" : "Edit"}
          </Button>
          {editing ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => void mutate("update")}
            >
              Save draft
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
