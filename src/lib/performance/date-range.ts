/** YYYY-MM-DD in UTC. */
export function isoDateUtc(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function daysAgoUtc(days: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - days);
  return isoDateUtc(d);
}

export const INCREMENTAL_SYNC_DAYS = 3;
export const BACKFILL_SYNC_DAYS = 30;

export function syncDateRange(opts: {
  backfill?: boolean;
  lastSyncedAt?: string | null;
}): { startDate: string; endDate: string } {
  const endDate = isoDateUtc();
  const days =
    opts.backfill || !opts.lastSyncedAt
      ? BACKFILL_SYNC_DAYS
      : INCREMENTAL_SYNC_DAYS;
  return { startDate: daysAgoUtc(days), endDate };
}
