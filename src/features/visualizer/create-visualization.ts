import type { AdChannelProvider, Visualization, VisualizationKind } from "@/domain";
import {
  createVisualizationRecord,
  emptyVisualizationData,
  visualizationDataFromPerformance,
} from "@/lib/performance/build-visualization-data";
import { daysAgoUtc, isoDateUtc } from "@/lib/performance/date-range";
import { getPerformanceRepository } from "@/repositories";
import type { PerformanceQueryResult } from "@/repositories/performance";

export type CreateVisualizationResult = {
  ok: true;
  visualizationId: string;
  href: string;
  visualization: Visualization;
  message: string;
  empty?: boolean;
};

export type CreateVisualizationFilters = {
  workspaceId: string;
  productId?: string;
  provider?: AdChannelProvider;
  connectionId?: string;
  startDate?: string;
  endDate?: string;
};

function parseQuarterRange(
  label: string | undefined,
): { startDate: string; endDate: string } | null {
  if (!label) return null;
  const match = label.trim().match(/^Q([1-4])\s*(20\d{2})$/i);
  if (!match) return null;
  const q = Number(match[1]);
  const year = Number(match[2]);
  const startMonth = (q - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 0));
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

async function loadPerformance(opts: {
  workspaceId: string;
  productId?: string;
  provider?: AdChannelProvider;
  connectionId?: string;
  startDate: string;
  endDate: string;
  groupBy?: "date" | "provider" | "campaign";
}): Promise<PerformanceQueryResult> {
  const performance = await getPerformanceRepository();
  return performance.queryPerformance({
    workspaceId: opts.workspaceId,
    productId: opts.productId,
    provider: opts.provider,
    connectionId: opts.connectionId,
    startDate: opts.startDate,
    endDate: opts.endDate,
    groupBy: opts.groupBy,
  });
}

export async function buildCreateVisualizationResult(input: {
  title: string;
  kind: VisualizationKind;
  prompt?: string;
  periodA?: string;
  periodB?: string;
  filters?: CreateVisualizationFilters;
}): Promise<CreateVisualizationResult> {
  const endDate = input.filters?.endDate ?? isoDateUtc();
  const startDate = input.filters?.startDate ?? daysAgoUtc(30);

  let data = emptyVisualizationData(input.kind);
  let empty = true;

  if (input.filters?.workspaceId) {
    try {
      if (input.kind === "comparison") {
        const rangeA = parseQuarterRange(input.periodA) ?? {
          startDate: daysAgoUtc(60),
          endDate: daysAgoUtc(31),
        };
        const rangeB = parseQuarterRange(input.periodB) ?? {
          startDate: daysAgoUtc(30),
          endDate,
        };
        const [periodAResult, periodBResult] = await Promise.all([
          loadPerformance({
            workspaceId: input.filters.workspaceId,
            productId: input.filters.productId,
            provider: input.filters.provider,
            connectionId: input.filters.connectionId,
            ...rangeA,
            groupBy: "date",
          }),
          loadPerformance({
            workspaceId: input.filters.workspaceId,
            productId: input.filters.productId,
            provider: input.filters.provider,
            connectionId: input.filters.connectionId,
            ...rangeB,
            groupBy: "date",
          }),
        ]);
        empty =
          periodAResult.series.length === 0 && periodBResult.series.length === 0;
        data = visualizationDataFromPerformance(input.kind, periodAResult, {
          periodAResult,
          periodBResult,
          periodA: input.periodA ?? "Period A",
          periodB: input.periodB ?? "Period B",
        });
      } else {
        const groupBy =
          input.kind === "bar" ? ("provider" as const) : ("date" as const);
        const result = await loadPerformance({
          workspaceId: input.filters.workspaceId,
          productId: input.filters.productId,
          provider: input.filters.provider,
          connectionId: input.filters.connectionId,
          startDate,
          endDate,
          groupBy,
        });
        empty =
          result.series.length === 0 &&
          result.breakdown.length === 0 &&
          result.totals.impressions === 0;
        data = visualizationDataFromPerformance(input.kind, result, {
          periodA: input.periodA,
          periodB: input.periodB,
        });
      }
    } catch {
      data = emptyVisualizationData(input.kind);
      empty = true;
    }
  }

  const visualization = createVisualizationRecord({
    title: input.title,
    kind: input.kind,
    prompt: input.prompt,
    data,
  });

  const message = empty
    ? `Created visualization "${visualization.title}" with no synced performance data yet. Connect an ad account and run a sync, or link campaigns to products.`
    : `Created visualization "${visualization.title}". Opening it in the visualizer.`;

  return {
    ok: true,
    visualizationId: visualization.id,
    href: `/visualizer/${visualization.id}`,
    visualization,
    message,
    empty,
  };
}

/** Sync helper for offline chat streams (empty charts, no DB). */
export function buildCreateVisualizationResultSync(input: {
  title: string;
  kind: VisualizationKind;
  prompt?: string;
  periodA?: string;
  periodB?: string;
}): CreateVisualizationResult {
  const visualization = createVisualizationRecord({
    title: input.title,
    kind: input.kind,
    prompt: input.prompt,
    data: emptyVisualizationData(input.kind),
  });
  return {
    ok: true,
    visualizationId: visualization.id,
    href: `/visualizer/${visualization.id}`,
    visualization,
    message: `Created visualization "${visualization.title}". Opening it in the visualizer.`,
    empty: true,
  };
}

export function inferVisualizationFromPrompt(prompt: string): {
  title: string;
  kind: VisualizationKind;
  periodA?: string;
  periodB?: string;
} | null {
  const lower = prompt.toLowerCase();
  const wantsViz =
    /\b(chart|visualiz|sankey|funnel|compar|vs\.?|versus|how did|performance|trend|revenue|q[1-4])\b/i.test(
      prompt,
    );
  if (!wantsViz) return null;

  const qMatch = prompt.match(
    /\b(Q[1-4]\s*20\d{2})\b.*?\b(Q[1-4]\s*20\d{2})\b/i,
  );
  if (qMatch || /\bvs\.?\b|\bversus\b/i.test(lower)) {
    return {
      title: qMatch
        ? `${qMatch[1]} vs ${qMatch[2]}`
        : "Campaign comparison",
      kind: "comparison",
      periodA: qMatch?.[1],
      periodB: qMatch?.[2],
    };
  }
  if (/\b(funnel|sankey|flow)\b/i.test(lower)) {
    return {
      title: "User acquisition funnel",
      kind: "sankey",
    };
  }
  if (/\b(channel|mix|spend by)\b/i.test(lower)) {
    return {
      title: "Channel mix",
      kind: "bar",
    };
  }
  return {
    title: "Campaign performance",
    kind: "timeseries",
  };
}
