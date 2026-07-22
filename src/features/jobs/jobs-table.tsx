"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronsUpDownIcon,
  Loader2Icon,
} from "@/components/icons";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserAvatar } from "@/features/avatars/user-avatar";
import { JOBS_PAGE_SIZE } from "@/features/jobs/jobs-constants";
import {
  JobsToolbar,
  type JobsDateRange,
  type JobsStatusFilter,
} from "@/features/jobs/jobs-toolbar";
import { cn } from "@/lib/utils";

export type JobCreator = {
  name?: string;
  email?: string;
  avatarUrl?: string | null;
};

export { JOBS_PAGE_SIZE };

type SortKey =
  | "when"
  | "type"
  | "status"
  | "user"
  | "product"
  | "trigger"
  | "result";

type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "when", label: "When" },
  { key: "type", label: "Type" },
  { key: "status", label: "Status" },
  { key: "user", label: "User" },
  { key: "product", label: "Product" },
  { key: "trigger", label: "Trigger" },
  { key: "result", label: "Result" },
];

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
    case "render_creative_video":
      return "Re-export video";
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

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateRangeStart(range: JobsDateRange): Date | null {
  if (range === "all") return null;
  if (range === "today") return startOfToday();
  const days =
    range === "last_7_days" ? 7 : range === "last_30_days" ? 30 : 90;
  const d = startOfToday();
  d.setDate(d.getDate() - (days - 1));
  return d;
}

function matchesDateRange(job: JobRun, range: JobsDateRange): boolean {
  const start = dateRangeStart(range);
  if (!start) return true;
  const created = new Date(job.createdAt);
  if (Number.isNaN(created.getTime())) return false;
  return created >= start;
}

function compareJobs(
  a: JobRun,
  b: JobRun,
  key: SortKey,
  dir: SortDir,
  productTitles: Record<string, string>,
  creators: Record<string, JobCreator>,
): number {
  const mul = dir === "asc" ? 1 : -1;
  let left = "";
  let right = "";

  switch (key) {
    case "when": {
      const at = new Date(a.createdAt).getTime();
      const bt = new Date(b.createdAt).getTime();
      return mul * ((Number.isNaN(at) ? 0 : at) - (Number.isNaN(bt) ? 0 : bt));
    }
    case "type":
      left = typeLabel(a.type);
      right = typeLabel(b.type);
      break;
    case "status":
      left = a.status;
      right = b.status;
      break;
    case "user":
      left = creatorDisplay(a.createdBy, creators).name;
      right = creatorDisplay(b.createdBy, creators).name;
      break;
    case "product":
      left = a.productId
        ? (productTitles[a.productId] ?? a.productId)
        : "";
      right = b.productId
        ? (productTitles[b.productId] ?? b.productId)
        : "";
      break;
    case "trigger":
      left = a.trigger;
      right = b.trigger;
      break;
    case "result":
      left = resultSummary(a);
      right = resultSummary(b);
      break;
  }

  return mul * left.localeCompare(right, undefined, { sensitivity: "base" });
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

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return (
      <ChevronsUpDownIcon className="size-3.5 shrink-0 opacity-40" aria-hidden />
    );
  }
  return dir === "asc" ? (
    <ChevronUpIcon className="size-3.5 shrink-0" aria-hidden />
  ) : (
    <ChevronDownIcon className="size-3.5 shrink-0" aria-hidden />
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
  const [statusFilter, setStatusFilter] = useState<JobsStatusFilter>("all");
  const [dateRange, setDateRange] = useState<JobsDateRange>("all");
  const [sortKey, setSortKey] = useState<SortKey>("when");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [hasMore, setHasMore] = useState(initialJobs.length >= JOBS_PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [, startTransition] = useTransition();
  const offsetRef = useRef(initialJobs.length);
  const loadingMoreRef = useRef(false);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const initialJobsKey = initialJobs.map((job) => job.id).join("|");
  useEffect(() => {
    setJobs(initialJobs);
    offsetRef.current = initialJobs.length;
    setHasMore(initialJobs.length >= JOBS_PAGE_SIZE);
    // Sync when the server payload's job set changes (soft nav / refresh).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by id set, not array identity
  }, [initialJobsKey]);

  const selected = jobs.find((j) => j.id === selectedId) ?? null;
  const selectedCreator = selected
    ? creatorDisplay(selected.createdBy, creators)
    : null;

  const visibleJobs = jobs
    .filter((job) =>
      statusFilter === "all" ? true : job.status === statusFilter,
    )
    .filter((job) => matchesDateRange(job, dateRange))
    .sort((a, b) =>
      compareJobs(a, b, sortKey, sortDir, productTitles, creators),
    );

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/jobs?limit=${JOBS_PAGE_SIZE}&offset=${offsetRef.current}`,
      );
      if (!res.ok) return;
      const body = (await res.json()) as { jobs?: JobRun[] };
      const next = body.jobs ?? [];
      offsetRef.current += next.length;
      setHasMore(next.length >= JOBS_PAGE_SIZE);
      if (next.length === 0) return;
      setJobs((prev) => {
        const seen = new Set(prev.map((j) => j.id));
        return [...prev, ...next.filter((j) => !seen.has(j.id))];
      });
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore]);

  useEffect(() => {
    const root = scrollRootRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      { root, rootMargin: "160px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore, visibleJobs.length]);

  // Keep fetching while filters hide every loaded row and more pages exist.
  useEffect(() => {
    if (jobs.length === 0 || visibleJobs.length > 0 || !hasMore) return;
    void loadMore();
  }, [jobs.length, visibleJobs.length, hasMore, loadMore]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "when" ? "desc" : "asc");
  }

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
      <JobsToolbar
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      {error ? (
        <div className="border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {jobs.length === 0 ? (
        <div className="m-4 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No jobs yet. Ask the agent to create a campaign, or POST to /api/jobs.
        </div>
      ) : (
        <div ref={scrollRootRef} className="min-h-0 flex-1 overflow-auto">
          {visibleJobs.length === 0 ? (
            <div className="m-4 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              {loadingMore || hasMore
                ? "Looking for matching jobs…"
                : "No jobs match the current filters."}
            </div>
          ) : (
            <table className="w-full min-w-[880px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  {COLUMNS.map((col) => {
                    const active = sortKey === col.key;
                    return (
                      <th
                        key={col.key}
                        className="sticky top-0 z-10 border-b bg-canvas/95 px-4 py-2.5 font-medium backdrop-blur supports-backdrop-filter:bg-canvas/80"
                        aria-sort={
                          active
                            ? sortDir === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                      >
                        <button
                          type="button"
                          className="-mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-muted/60 hover:text-foreground"
                          onClick={() => toggleSort(col.key)}
                        >
                          {col.label}
                          <SortIcon active={active} dir={sortDir} />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleJobs.map((job) => {
                  const creator = creatorDisplay(job.createdBy, creators);
                  const isSelected = job.id === selectedId;
                  return (
                    <tr
                      key={job.id}
                      tabIndex={0}
                      aria-selected={isSelected}
                      className={cn(
                        "cursor-pointer outline-none transition-colors",
                        isSelected
                          ? "bg-muted/60 hover:bg-muted/70 focus-visible:bg-muted/80"
                          : "odd:bg-muted/30 hover:bg-muted/70 focus-visible:bg-muted/80",
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
                        <Tooltip>
                          <TooltipTrigger
                            delay={50}
                            className="inline-flex rounded-full"
                            aria-label={creator.name}
                          >
                            <UserAvatar
                              name={creator.name}
                              email={creator.email}
                              avatarUrl={creator.avatarUrl}
                              size="sm"
                            />
                          </TooltipTrigger>
                          <TooltipContent>{creator.name}</TooltipContent>
                        </Tooltip>
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
          )}
          {hasMore ? (
            <div
              ref={sentinelRef}
              className="flex justify-center py-3"
              aria-hidden
            >
              {loadingMore ? (
                <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
              ) : null}
            </div>
          ) : null}
        </div>
      )}

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
