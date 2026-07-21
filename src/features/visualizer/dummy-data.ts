import type {
  BarData,
  ComparisonData,
  SankeyData,
  TimeseriesData,
  Visualization,
  VisualizationKind,
} from "@/domain";

function newVizId() {
  return `viz_${crypto.randomUUID().slice(0, 10)}`;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

type WavePoint = {
  date: string;
  value: number;
  revenue: number;
  spend: number;
  conversions: number;
  clicks: number;
  impressions: number;
};

function waveSeries(
  days: number,
  base: number,
  amp: number,
  phase = 0,
): WavePoint[] {
  return Array.from({ length: days }, (_, i) => {
    const t = i / Math.max(days - 1, 1);
    const revenue = Math.round(
      base + amp * Math.sin(t * Math.PI * 2 + phase) + amp * 0.25 * t,
    );
    const spend = Math.round(revenue * (0.32 + 0.08 * Math.sin(t * 4 + phase)));
    const clicks = Math.round(spend * (1.1 + 0.2 * Math.cos(t * 3)));
    const impressions = Math.round(clicks * (28 + 6 * Math.sin(t * 2 + phase)));
    const conversions = Math.round(clicks * (0.08 + 0.03 * Math.sin(t * 5)));
    return {
      date: isoDaysAgo(days - 1 - i),
      value: Math.max(0, revenue),
      revenue: Math.max(0, revenue),
      spend: Math.max(0, spend),
      conversions: Math.max(0, conversions),
      clicks: Math.max(0, clicks),
      impressions: Math.max(0, impressions),
    };
  });
}

export function buildSankeyData(): SankeyData {
  return {
    nodes: [
      { name: "Paid Social" },
      { name: "Search" },
      { name: "Email" },
      { name: "Organic" },
      { name: "Landing" },
      { name: "Product Page" },
      { name: "Cart" },
      { name: "Checkout" },
      { name: "Purchase" },
    ],
    links: [
      { source: "Paid Social", target: "Landing", value: 4200 },
      { source: "Search", target: "Landing", value: 2800 },
      { source: "Email", target: "Landing", value: 1600 },
      { source: "Organic", target: "Landing", value: 2100 },
      { source: "Landing", target: "Product Page", value: 7400 },
      { source: "Landing", target: "Cart", value: 900 },
      { source: "Product Page", target: "Cart", value: 3100 },
      { source: "Cart", target: "Checkout", value: 2400 },
      { source: "Checkout", target: "Purchase", value: 1650 },
    ],
  };
}

export function buildTimeseriesData(
  metric = "Revenue ($)",
): TimeseriesData {
  return {
    metric,
    series: [
      {
        name: "Meta",
        points: waveSeries(28, 1800, 420, 0.8),
      },
      {
        name: "Google",
        points: waveSeries(28, 1500, 380, 1.4),
      },
      {
        name: "Email",
        points: waveSeries(28, 900, 220, 2.1),
      },
      {
        name: "TikTok",
        points: waveSeries(28, 1100, 310, 0.4),
      },
    ],
  };
}

export function buildComparisonData(options?: {
  periodA?: string;
  periodB?: string;
  metric?: string;
}): ComparisonData {
  const periodA = options?.periodA?.trim() || "Q1 2026";
  const periodB = options?.periodB?.trim() || "Q2 2026";
  return {
    metric: options?.metric ?? "Revenue ($)",
    series: [
      {
        name: periodA,
        points: waveSeries(12, 3800, 700, 0.1).map((p, i) => ({
          ...p,
          date: `W${i + 1}`,
        })),
      },
      {
        name: periodB,
        points: waveSeries(12, 4600, 850, 1.1).map((p, i) => ({
          ...p,
          date: `W${i + 1}`,
        })),
      },
    ],
  };
}

export function buildBarData(metric = "Spend ($)"): BarData {
  return {
    metric,
    categories: ["Meta", "Google", "Email", "TikTok", "Affiliate"],
    series: [
      {
        name: "Spend",
        values: [12400, 9800, 3200, 6100, 2700],
      },
      {
        name: "Revenue",
        values: [31200, 24600, 9100, 14200, 6800],
      },
      {
        name: "Conversions",
        values: [840, 620, 410, 290, 150],
      },
      {
        name: "Clicks",
        values: [12800, 9400, 5100, 4300, 2100],
      },
    ],
  };
}

export function buildVisualizationData(
  kind: VisualizationKind,
  options?: { periodA?: string; periodB?: string },
): Visualization["data"] {
  switch (kind) {
    case "sankey":
      return buildSankeyData();
    case "timeseries":
      return buildTimeseriesData();
    case "comparison":
      return buildComparisonData(options);
    case "bar":
      return buildBarData();
  }
}

export function createVisualization(input: {
  title: string;
  kind: VisualizationKind;
  prompt?: string;
  periodA?: string;
  periodB?: string;
  id?: string;
}): Visualization {
  const now = new Date().toISOString();
  return {
    id: input.id ?? newVizId(),
    title: input.title,
    kind: input.kind,
    prompt: input.prompt,
    data: buildVisualizationData(input.kind, {
      periodA: input.periodA,
      periodB: input.periodB,
    }),
    createdAt: now,
    updatedAt: now,
  };
}

export type VisualizationTemplate = {
  id: string;
  title: string;
  description: string;
  kind: VisualizationKind;
  periodA?: string;
  periodB?: string;
};

export const VISUALIZATION_TEMPLATES: VisualizationTemplate[] = [
  {
    id: "tpl_sankey_funnel",
    title: "User acquisition funnel",
    description: "Sankey flow from channels through purchase.",
    kind: "sankey",
  },
  {
    id: "tpl_campaign_perf",
    title: "Campaign performance",
    description: "Revenue trend across recent campaigns.",
    kind: "timeseries",
  },
  {
    id: "tpl_q1_q2",
    title: "Q1 vs Q2 campaigns",
    description: "Overlapping weekly revenue for two quarters.",
    kind: "comparison",
    periodA: "Q1 2026",
    periodB: "Q2 2026",
  },
  {
    id: "tpl_channel_mix",
    title: "Channel mix",
    description: "Spend and revenue by acquisition channel.",
    kind: "bar",
  },
];

export function seedRecents(): Visualization[] {
  const base = Date.now();
  return [
    createVisualization({
      id: "viz_seed_funnel",
      title: "User acquisition funnel",
      kind: "sankey",
      prompt: "Show me how users flow to purchase",
    }),
    createVisualization({
      id: "viz_seed_q_compare",
      title: "Q1 2026 vs Q2 2026",
      kind: "comparison",
      prompt: "How did Q1 2026 do vs Q2?",
      periodA: "Q1 2026",
      periodB: "Q2 2026",
    }),
    createVisualization({
      id: "viz_seed_channels",
      title: "Channel mix",
      kind: "bar",
      prompt: "Break down spend and revenue by channel",
    }),
    createVisualization({
      id: "viz_seed_campaigns",
      title: "Campaign performance",
      kind: "timeseries",
      prompt: "Revenue trend across recent campaigns",
    }),
  ].map((viz, i) => {
    const createdAt = new Date(base - (i + 1) * 86_400_000).toISOString();
    return { ...viz, createdAt, updatedAt: createdAt };
  });
}
