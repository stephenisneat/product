"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import type { JobRun } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { UserAvatar } from "@/features/avatars/user-avatar";
import { cn } from "@/lib/utils";

export type JobCreator = {
  name?: string;
  email?: string;
  avatarUrl?: string | null;
};

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

function statusVariant(
  status: JobRun["status"],
): "secondary" | "outline" | "destructive" | "default" {
  switch (status) {
    case "failed":
      return "destructive";
    case "succeeded":
      return "default";
    case "running":
    case "pending":
      return "secondary";
    default:
      return "outline";
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

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
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
  return "—";
}

function canCancel(status: JobRun["status"]): boolean {
  return status === "pending" || status === "running";
}

function creatorDisplay(
  createdBy: string | null,
  creators: Record<string, JobCreator>,
): { name: string; email?: string; avatarUrl?: string | null } {
  if (!createdBy) {
    return { name: "System" };
  }
  const creator = creators[createdBy];
  if (!creator) {
    return { name: createdBy.slice(0, 8) };
  }
  return {
    name: creator.name || creator.email || createdBy.slice(0, 8),
    email: creator.email,
    avatarUrl: creator.avatarUrl,
  };
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1 border-b border-border/60 py-3 last:border-b-0 sm:grid-cols-[120px_1fr] sm:gap-4">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-48 overflow-auto rounded-md bg-muted/50 p-2.5 font-mono text-xs break-all whitespace-pre-wrap">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function JobsTable({
  initialJobs,
  productTitles,
  creators,
}: {
  initialJobs: JobRun[];
  productTitles: Record<string, string>;
  creators: Record<string, JobCreator>;
}) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initialJobs);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const selected = jobs.find((j) => j.id === selectedId) ?? null;
  const selectedCreator = selected
    ? creatorDisplay(selected.createdBy, creators)
    : null;

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
      setJobs((prev) => prev.map((j) => (j.id === jobId ? body.job : j)));
      startTransition(() => router.refresh());
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {error ? (
        <div className="border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[880px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              {(
                [
                  "When",
                  "Type",
                  "Status",
                  "User",
                  "Product",
                  "Trigger",
                  "Result",
                ] as const
              ).map((label) => (
                <th
                  key={label}
                  className="sticky top-0 z-10 border-b bg-canvas/95 px-4 py-2.5 font-medium backdrop-blur supports-backdrop-filter:bg-canvas/80"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => {
              const creator = creatorDisplay(job.createdBy, creators);
              const isSelected = job.id === selectedId;
              return (
                <tr
                  key={job.id}
                  tabIndex={0}
                  aria-selected={isSelected}
                  className={cn(
                    "cursor-pointer outline-none hover:bg-muted/40 focus-visible:bg-muted/50",
                    isSelected && "bg-muted/50",
                  )}
                  onClick={() => setSelectedId(job.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedId(job.id);
                    }
                  }}
                >
                  <td className="whitespace-nowrap border-b border-border/60 px-4 py-3 text-muted-foreground">
                    {formatWhen(job.createdAt)}
                  </td>
                  <td className="border-b border-border/60 px-4 py-3">
                    {typeLabel(job.type)}
                  </td>
                  <td className="border-b border-border/60 px-4 py-3">
                    <Badge variant={statusVariant(job.status)}>
                      {statusLabel(job.status)}
                    </Badge>
                  </td>
                  <td className="border-b border-border/60 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <UserAvatar
                        name={creator.name}
                        email={creator.email}
                        avatarUrl={creator.avatarUrl}
                        size="sm"
                      />
                      <span className="truncate">{creator.name}</span>
                    </div>
                  </td>
                  <td className="max-w-[180px] truncate border-b border-border/60 px-4 py-3 text-muted-foreground">
                    {job.productId
                      ? (productTitles[job.productId] ??
                        job.productId.slice(0, 8))
                      : "—"}
                  </td>
                  <td className="border-b border-border/60 px-4 py-3 text-muted-foreground">
                    {triggerLabel(job.trigger)}
                  </td>
                  <td className="max-w-[220px] truncate border-b border-border/60 px-4 py-3 text-muted-foreground">
                    {resultSummary(job)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Sheet
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full gap-0 sm:max-w-md"
          showCloseButton
        >
          {selected && selectedCreator ? (
            <>
              <SheetHeader className="border-b">
                <SheetTitle>{typeLabel(selected.type)}</SheetTitle>
                <SheetDescription>
                  Job {selected.id.slice(0, 8)}…
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-4">
                <dl>
                  <DetailRow label="Status">
                    <Badge variant={statusVariant(selected.status)}>
                      {statusLabel(selected.status)}
                    </Badge>
                  </DetailRow>
                  <DetailRow label="User">
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        name={selectedCreator.name}
                        email={selectedCreator.email}
                        avatarUrl={selectedCreator.avatarUrl}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="truncate">{selectedCreator.name}</p>
                        {selectedCreator.email ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {selectedCreator.email}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </DetailRow>
                  <DetailRow label="Product">
                    {selected.productId
                      ? (productTitles[selected.productId] ??
                        selected.productId)
                      : "—"}
                  </DetailRow>
                  <DetailRow label="Trigger">
                    {triggerLabel(selected.trigger)}
                  </DetailRow>
                  <DetailRow label="Created">
                    {formatWhen(selected.createdAt)}
                  </DetailRow>
                  <DetailRow label="Started">
                    {formatWhen(selected.startedAt)}
                  </DetailRow>
                  <DetailRow label="Finished">
                    {formatWhen(selected.finishedAt)}
                  </DetailRow>
                  {selected.error ? (
                    <DetailRow label="Error">
                      <p className="text-destructive">{selected.error}</p>
                    </DetailRow>
                  ) : null}
                  {selected.result ? (
                    <DetailRow label="Result">
                      <JsonBlock value={selected.result} />
                    </DetailRow>
                  ) : null}
                  <DetailRow label="Input">
                    <JsonBlock value={selected.input} />
                  </DetailRow>
                  {selected.triggerRunId ? (
                    <DetailRow label="Run ID">
                      <span className="font-mono text-xs break-all">
                        {selected.triggerRunId}
                      </span>
                    </DetailRow>
                  ) : null}
                </dl>
              </div>

              {canCancel(selected.status) ? (
                <SheetFooter className="border-t">
                  <Button
                    variant="destructive"
                    disabled={pendingId === selected.id}
                    onClick={() => void cancelJob(selected.id)}
                  >
                    {pendingId === selected.id ? "Canceling…" : "Cancel job"}
                  </Button>
                </SheetFooter>
              ) : null}
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
