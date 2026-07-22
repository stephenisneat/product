import type { AdChannelProvider } from "@/domain";
import { googlePerformanceProvider } from "@/lib/performance/providers/google";
import {
  amazonPerformanceProvider,
  metaPerformanceProvider,
  tiktokPerformanceProvider,
  xPerformanceProvider,
} from "@/lib/performance/providers/stubs";
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
