"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminFeedback } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function kindLabel(kind: string) {
  if (kind === "channel_request") return "Channel request";
  if (kind === "bug") return "Bug";
  if (kind === "feature") return "Feature request";
  return kind;
}

function statusLabel(status: AdminFeedback["status"]) {
  switch (status) {
    case "pending":
      return "New";
    case "prompt_ready":
      return "Prompt ready";
    case "dispatched":
      return "Agent running";
    case "pr_open":
      return "PR open";
    case "fulfilled":
      return "Fulfilled";
    case "rejected":
      return "Rejected";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

function statusVariant(
  status: AdminFeedback["status"],
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "fulfilled":
      return "default";
    case "rejected":
    case "failed":
      return "destructive";
    case "prompt_ready":
    case "dispatched":
    case "pr_open":
      return "secondary";
    default:
      return "outline";
  }
}

export function AdminFeedbackInbox({
  items: initialItems,
}: {
  items: AdminFeedback[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    for (const item of initialItems) {
      next[item.id] = item.approvedPrompt ?? item.generatedPrompt ?? "";
    }
    return next;
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function upsert(feedback: AdminFeedback) {
    setItems((prev) =>
      prev.map((item) => (item.id === feedback.id ? feedback : item)),
    );
    setDrafts((prev) => ({
      ...prev,
      [feedback.id]:
        feedback.approvedPrompt ?? feedback.generatedPrompt ?? prev[feedback.id] ?? "",
    }));
  }

  async function callAction(
    id: string,
    path: string,
    init?: RequestInit,
  ): Promise<AdminFeedback | null> {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/feedback/${id}/${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        feedback?: AdminFeedback;
      };
      if (!res.ok) throw new Error(body.error || "Request failed");
      if (body.feedback) {
        upsert(body.feedback);
        router.refresh();
        return body.feedback;
      }
      return null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      return null;
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No feedback yet.</p>;
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ul className="divide-y divide-border rounded-lg border border-border">
        {items.map((row) => {
          const busy = busyId === row.id;
          const draft = drafts[row.id] ?? "";
          const canEditPrompt =
            row.status === "prompt_ready" || row.status === "failed";
          const canApprove =
            row.status === "pending" || row.status === "failed";
          const canReject =
            row.status === "pending" ||
            row.status === "prompt_ready" ||
            row.status === "failed";
          const canDispatch = canEditPrompt && draft.trim().length > 0;

          return (
            <li key={row.id} className="space-y-3 px-4 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{row.title}</p>
                  <Badge variant={statusVariant(row.status)}>
                    {statusLabel(row.status)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatWhen(row.createdAt)}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {kindLabel(row.kind)}
                {row.userEmail ? ` · ${row.userEmail}` : null}
              </p>
              {row.body ? (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {row.body}
                </p>
              ) : null}
              {row.screenshotUrl ? (
                <a
                  href={row.screenshotUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-md border border-border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={row.screenshotUrl}
                    alt="Attached screenshot"
                    className="max-h-64 w-full object-contain bg-muted/30"
                  />
                </a>
              ) : null}

              {row.errorMessage ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {row.errorMessage}
                </p>
              ) : null}

              {(row.cursorAgentUrl || row.prUrl || row.branchName) && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {row.cursorAgentUrl ? (
                    <a
                      href={row.cursorAgentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-foreground underline-offset-4 hover:underline"
                    >
                      Cursor agent
                    </a>
                  ) : null}
                  {row.prUrl ? (
                    <a
                      href={row.prUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-foreground underline-offset-4 hover:underline"
                    >
                      Pull request{row.prNumber ? ` #${row.prNumber}` : ""}
                    </a>
                  ) : null}
                  {row.branchName ? (
                    <span className="text-muted-foreground">
                      Branch: {row.branchName}
                    </span>
                  ) : null}
                </div>
              )}

              {canEditPrompt ? (
                <div className="space-y-2">
                  <label
                    htmlFor={`prompt-${row.id}`}
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Agent prompt
                  </label>
                  <Textarea
                    id={`prompt-${row.id}`}
                    value={draft}
                    disabled={busy}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [row.id]: e.target.value,
                      }))
                    }
                    className="min-h-40 font-mono text-xs"
                  />
                </div>
              ) : null}

              {(row.status === "dispatched" ||
                row.status === "pr_open" ||
                row.status === "fulfilled") &&
              (row.approvedPrompt || row.generatedPrompt) ? (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none">
                    View prompt
                  </summary>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 font-mono text-[11px] text-foreground">
                    {row.approvedPrompt ?? row.generatedPrompt}
                  </pre>
                </details>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {canApprove ? (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => void callAction(row.id, "approve", { method: "POST" })}
                  >
                    {busy ? "Working…" : "Approve & generate prompt"}
                  </Button>
                ) : null}
                {canEditPrompt ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || !draft.trim()}
                      onClick={() =>
                        void callAction(row.id, "prompt", {
                          method: "PATCH",
                          body: JSON.stringify({ prompt: draft }),
                        })
                      }
                    >
                      Save prompt
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void callAction(row.id, "prompt", { method: "POST" })
                      }
                    >
                      Regenerate
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy || !canDispatch}
                      onClick={() =>
                        void callAction(row.id, "dispatch", {
                          method: "POST",
                          body: JSON.stringify({ prompt: draft }),
                        })
                      }
                    >
                      {busy ? "Launching…" : "Approve prompt & launch agent"}
                    </Button>
                  </>
                ) : null}
                {canReject ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void callAction(row.id, "reject", { method: "POST" })}
                  >
                    Reject
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
