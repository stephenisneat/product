import type { AdChannelProvider } from "@/domain";
import { amazonPerformanceProvider } from "@/lib/performance/providers/amazon";
import { googlePerformanceProvider } from "@/lib/performance/providers/google";
import { metaPerformanceProvider } from "@/lib/performance/providers/meta";
import { tiktokPerformanceProvider } from "@/lib/performance/providers/tiktok";
import { xPerformanceProvider } from "@/lib/performance/providers/x";
import type { PerformanceProvider } from "@/lib/performance/types";

const providers: Record<AdChannelProvider, PerformanceProvider> = {
  google: googlePerformanceProvider,
  meta: metaPerformanceProvider,
  tiktok: tiktokPerformanceProvider,
  amazon: amazonPerformanceProvider,
  x: xPerformanceProvider,
};

export function getPerformanceProvider(
  provider: AdChannelProvider,
): PerformanceProvider {
  return providers[provider];
}
