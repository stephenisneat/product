import { redirect } from "next/navigation";
import type { JobRun } from "@/domain";
import { PageCanvas } from "@/components/layout/page-canvas";
import { JOBS_PAGE_SIZE } from "@/features/jobs/jobs-constants";
import {
  JobsTable,
  type JobCreator,
} from "@/features/jobs/jobs-table";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import {
  getJobRepository,
  getProductRepository,
  getWorkspaceRepository,
} from "@/repositories";

export default async function JobsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/logs");
  }

  const active = await getActiveWorkspace();
  if (!active) {
    redirect("/");
  }

  let jobs: JobRun[] = [];
  let productTitles: Record<string, string> = {};
  let creators: Record<string, JobCreator> = {};
  let loadError: string | null = null;

  try {
    const [jobsRepo, productsRepo, workspaceRepo] = await Promise.all([
      getJobRepository(),
      getProductRepository(),
      getWorkspaceRepository(),
    ]);
    const [jobList, products, members] = await Promise.all([
      jobsRepo.listByWorkspace(active.workspace.id, { limit: JOBS_PAGE_SIZE }),
      productsRepo.listProducts(active.workspace.id),
      workspaceRepo.listMembers(active.workspace.id),
    ]);
    jobs = jobList;
    productTitles = Object.fromEntries(products.map((p) => [p.id, p.title]));
    creators = Object.fromEntries(
      members.map((m) => [
        m.userId,
        {
          name: m.name,
          email: m.email,
          avatarUrl: m.avatarUrl,
        } satisfies JobCreator,
      ]),
    );
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load jobs";
  }

  return (
    <PageCanvas contentClassName="flex flex-col overflow-hidden">
      {loadError ? (
        <div className="m-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {loadError}
        </div>
      ) : (
        <JobsTable
          key={active.workspace.id}
          initialJobs={jobs}
          productTitles={productTitles}
          creators={creators}
        />
      )}
    </PageCanvas>
  );
}
