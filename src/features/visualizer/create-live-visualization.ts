import type { Visualization, VisualizationKind } from "@/domain";
import {
  createVisualizationRecord,
  emptyVisualizationData,
  visualizationDataFromPerformance,
} from "@/lib/performance/build-visualization-data";
import type { PerformanceQueryResult } from "@/repositories/performance";

type PerformanceApiResponse = PerformanceQueryResult & {
  startDate: string;
  endDate: string;
};

async function fetchPerformance(params: {
  startDate?: string;
  endDate?: string;
  productId?: string;
  provider?: string;
  groupBy?: "date" | "provider" | "campaign";
}): Promise<PerformanceApiResponse | null> {
  const qs = new URLSearchParams();
  if (params.startDate) qs.set("startDate", params.startDate);
  if (params.endDate) qs.set("endDate", params.endDate);
  if (params.productId) qs.set("productId", params.productId);
  if (params.provider) qs.set("provider", params.provider);
  if (params.groupBy) qs.set("groupBy", params.groupBy);
  const res = await fetch(`/api/performance?${qs.toString()}`);
  if (!res.ok) return null;
  return (await res.json()) as PerformanceApiResponse;
}

/** Client-side: build a visualization from live workspace performance (or empty). */
export async function createLiveVisualization(input: {
  title: string;
  kind: VisualizationKind;
  prompt?: string;
  periodA?: string;
  periodB?: string;
  productId?: string;
}): Promise<Visualization> {
  const groupBy = input.kind === "bar" ? "provider" : "date";
  const result = await fetchPerformance({
    productId: input.productId,
    groupBy,
  });

  if (!result) {
    return createVisualizationRecord({
      title: input.title,
      kind: input.kind,
      prompt: input.prompt,
      data: emptyVisualizationData(input.kind),
    });
  }

  const empty =
    result.series.length === 0 &&
    result.breakdown.length === 0 &&
    result.totals.impressions === 0;

  return createVisualizationRecord({
    title: input.title,
    kind: input.kind,
    prompt: input.prompt,
    data: empty
      ? emptyVisualizationData(input.kind)
      : visualizationDataFromPerformance(input.kind, result, {
          periodA: input.periodA,
          periodB: input.periodB,
        }),
  });
}
