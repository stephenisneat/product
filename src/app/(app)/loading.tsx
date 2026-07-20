export default function AppLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
        <div className="h-4 w-20 animate-pulse rounded bg-muted/60" />
        <div className="h-4 w-16 animate-pulse rounded bg-muted/40" />
        <div className="h-4 w-16 animate-pulse rounded bg-muted/40" />
      </div>
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
        <div className="h-4 w-2/3 max-w-md animate-pulse rounded bg-muted/50" />
        <div className="space-y-3">
          <div className="h-28 animate-pulse rounded-lg border border-border bg-muted/30" />
          <div className="h-28 animate-pulse rounded-lg border border-border bg-muted/25" />
          <div className="h-28 animate-pulse rounded-lg border border-border bg-muted/20" />
        </div>
      </div>
    </div>
  );
}
