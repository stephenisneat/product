import { redirect } from "next/navigation";
import type { JobRun } from "@/domain";
import { PageCanvas } from "@/components/layout/page-canvas";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { getJobRepository, getProductRepository } from "@/repositories";

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

export default async function JobsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/jobs");
  }

  const active = await getActiveWorkspace();
  if (!active) {
    redirect("/");
  }

  let jobs: JobRun[] = [];
  let productTitles = new Map<string, string>();
  let loadError: string | null = null;

  try {
    const [jobsRepo, productsRepo] = await Promise.all([
      getJobRepository(),
      getProductRepository(),
    ]);
    const [jobList, products] = await Promise.all([
      jobsRepo.listByWorkspace(active.workspace.id, { limit: 100 }),
      productsRepo.listProducts(active.workspace.id),
    ]);
    jobs = jobList;
    productTitles = new Map(products.map((p) => [p.id, p.title]));
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load jobs";
  }

  return (
    <PageCanvas>
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="mb-6">
          <h1 className="font-heading text-xl font-semibold tracking-tight">
            Jobs
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Background jobs and runs for {active.workspace.name}.
          </p>
        </div>

        {loadError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {loadError}
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No jobs yet. Ask the agent to create a campaign, or POST to
            /api/jobs.
          </div>
        ) : (
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
                        ? (productTitles.get(job.productId) ??
                          job.productId.slice(0, 8))
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {triggerLabel(job.trigger)}
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-2.5 text-muted-foreground">
                      {resultSummary(job)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageCanvas>
  );
}
