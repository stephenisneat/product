import type { Visualization, VisualizationKind } from "@/domain";
import { createVisualization } from "@/features/visualizer/dummy-data";

export type CreateVisualizationResult = {
  ok: true;
  visualizationId: string;
  href: string;
  visualization: Visualization;
  message: string;
};

export function buildCreateVisualizationResult(input: {
  title: string;
  kind: VisualizationKind;
  prompt?: string;
  periodA?: string;
  periodB?: string;
}): CreateVisualizationResult {
  const visualization = createVisualization({
    title: input.title,
    kind: input.kind,
    prompt: input.prompt,
    periodA: input.periodA,
    periodB: input.periodB,
  });
  return {
    ok: true,
    visualizationId: visualization.id,
    href: `/visualizer/${visualization.id}`,
    visualization,
    message: `Created visualization "${visualization.title}". Opening it in the visualizer.`,
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
