import { redirect } from "next/navigation";
import type { JobRun } from "@/domain";
import { PageCanvas } from "@/components/layout/page-canvas";
import { JobsTable } from "@/features/jobs/jobs-table";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { getJobRepository, getProductRepository } from "@/repositories";

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
  let productTitles: Record<string, string> = {};
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
    productTitles = Object.fromEntries(products.map((p) => [p.id, p.title]));
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
          <JobsTable initialJobs={jobs} productTitles={productTitles} />
        )}
      </div>
    </PageCanvas>
  );
}
