export default function SettingsLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-10">
      <div className="space-y-2">
        <div className="h-6 w-40 animate-pulse rounded bg-muted/60" />
        <div className="h-4 w-64 animate-pulse rounded bg-muted/40" />
      </div>
      <div className="space-y-3">
        <div className="h-12 animate-pulse rounded-lg border border-border bg-muted/30" />
        <div className="h-12 animate-pulse rounded-lg border border-border bg-muted/25" />
        <div className="h-12 animate-pulse rounded-lg border border-border bg-muted/20" />
        <div className="h-24 animate-pulse rounded-lg border border-border bg-muted/20" />
      </div>
    </div>
  );
}
