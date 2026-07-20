"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { JobRun } from "@/domain";
import { Button } from "@/components/ui/button";

function typeLabel(type: JobRun["type"]): string {
  switch (type) {
    case "create_campaign":
      return "Create campaign";
    case "generate_creative_screenplay":
      return "Generate screenplay";
    case "generate_creative_storyboard":
      return "Generate storyboard";
    case "generate_creative_video":
      return "Generate video";
    case "generate_insight":
      return "Generate insight";
    default:
      return type;
  }
}

function statusLabel(status: JobRun["status"]): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "running":
      return "Running";
    case "succeeded":
      return "Succeeded";
    case "failed":
      return "Failed";
    case "canceled":
      return "Canceled";
    default:
      return status;
  }
}

function triggerLabel(trigger: JobRun["trigger"]): string {
  switch (trigger) {
    case "agent":
      return "Agent";
    case "api":
      return "API";
    case "cron":
      return "Cron";
    case "event":
      return "Event";
    default:
      return trigger;
  }
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function resultSummary(job: JobRun): string {
  if (job.error) return job.error;
  if (job.result && typeof job.result.campaignId === "string") {
    return `Campaign ${job.result.campaignId.slice(0, 8)}…`;
  }
  if (job.result && typeof job.result.creativeId === "string") {
    const stage =
      typeof job.result.stage === "string" ? ` (${job.result.stage})` : "";
    return `Creative ${job.result.creativeId.slice(0, 8)}…${stage}`;
  }
  if (job.result && typeof job.result.insightId === "string") {
    return `Insight ${job.result.insightId.slice(0, 8)}…`;
  }
  if (job.status === "pending" || job.status === "running") return "—";
  return "—";
}

function canCancel(status: JobRun["status"]): boolean {
  return status === "pending" || status === "running";
}

export function JobsTable({
  initialJobs,
  productTitles,
}: {
  initialJobs: JobRun[];
  productTitles: Record<string, string>;
}) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initialJobs);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function cancelJob(jobId: string) {
    setError(null);
    setPendingId(jobId);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error ?? "Failed to cancel job");
        return;
      }
      const body = (await res.json()) as { job: JobRun };
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? body.job : j)),
      );
      startTransition(() => router.refresh());
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-2">
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 font-medium">Trigger</th>
              <th className="px-3 py-2 font-medium">Result</th>
              <th className="px-3 py-2 font-medium"> </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-muted/30">
                <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                  {formatWhen(job.createdAt)}
                </td>
                <td className="px-3 py-2.5">{typeLabel(job.type)}</td>
                <td className="px-3 py-2.5">{statusLabel(job.status)}</td>
                <td className="max-w-[140px] truncate px-3 py-2.5 text-muted-foreground">
                  {job.productId
                    ? (productTitles[job.productId] ??
                      job.productId.slice(0, 8))
                    : "—"}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {triggerLabel(job.trigger)}
                </td>
                <td className="max-w-[180px] truncate px-3 py-2.5 text-muted-foreground">
                  {resultSummary(job)}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {canCancel(job.status) ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      disabled={pendingId === job.id}
                      onClick={() => void cancelJob(job.id)}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
